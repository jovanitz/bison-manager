import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { fixedClock } from '@acme/shared';
import { createApiRuntime } from '../../composition-root';
import { callRpc, errorTag } from '../../testing/rpc-harness';
import type { TestApp } from '../../testing/rpc-harness';

/**
 * ADR-0016 Decision 4, org-creation enforcement E2E: birth is atomic (the new
 * org's subscription is readable through `billing.summary`), the Free
 * ownership limit denies a second org with the upsell tag, and — trial-once
 * per identity — a later second org (after staff raise the limit) is born
 * with its trial already consumed. Real JWT pipeline, in-memory store (the
 * identity happy paths live in ../../identity/rpc-identity.spec.ts).
 */
const SECRET = 'test-secret-at-least-32-characters-long!';
const OWNER_EMAIL = 'owner@example.com';
const NOW = '2026-07-04T12:00:00.000Z';
const FIRST_TRIAL_ENDS = '2026-10-04T12:00:00.000Z'; // NOW + 3 months

const tokenFor = (input: {
  userId: string;
  sessionId: string;
  email: string;
}) =>
  sign(
    {
      sub: input.userId,
      session_id: input.sessionId,
      email: input.email,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
  );

const ownerToken = () =>
  tokenFor({
    userId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    email: OWNER_EMAIL,
  });

const enforcementRuntime = () =>
  createApiRuntime({
    seed: {},
    jwtSecret: SECRET,
    bootstrapOwnerEmail: OWNER_EMAIL,
    clock: fixedClock(new Date(NOW)),
  });

const createOrg = (app: TestApp, token: string, name: string) =>
  app.request('/id/create-organization', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

const summaryOf = async (res: Response) =>
  (
    (await res.json()) as {
      data: { planKey: string; phase: string; trialEndsAt: string };
    }
  ).data;

describe('create-organization enforcement (ADR-0016)', () => {
  it('births the subscription, denies the 2nd org, consumes the trial once', async () => {
    const { app } = enforcementRuntime();
    const owner = await ownerToken();
    await callRpc(app, 'access.current', { token: owner });

    // self-signup: the org is born WITH its subscription (Free, trialing)
    const userId = crypto.randomUUID();
    const token = await tokenFor({
      userId,
      sessionId: crypto.randomUUID(),
      email: 'founder@example.com',
    });
    expect((await createOrg(app, token, 'First Clinic')).status).toBe(200);
    const first = (
      (await (await callRpc(app, 'access.current', { token })).json()) as {
        data: { accountId: string };
      }
    ).data;
    const firstSummary = await callRpc(app, 'billing.summary', {
      token,
      body: { accountId: first.accountId },
    });
    expect(firstSummary.status).toBe(200);
    expect(await summaryOf(firstSummary)).toMatchObject({
      planKey: 'free',
      phase: 'trialing',
      trialEndsAt: FIRST_TRIAL_ENDS,
    });

    // the DENIED create surfaces the upsell tag (Free owns at most 1 org)
    const denied = await createOrg(app, token, 'Second Clinic');
    expect(denied.status).toBe(400);
    expect(await errorTag(denied)).toBe('app/plan-limit-exceeded');

    // staff raise the default plan's ownership limit (live edit, CAS-guarded)
    const plans = (
      (await (await callRpc(app, 'plans.list', { token: owner })).json()) as {
        data: ReadonlyArray<{ id: string; key: string; version: number }>;
      }
    ).data;
    const free = plans.find((p) => p.key === 'free');
    const raised = await callRpc(app, 'plans.update', {
      token: owner,
      body: {
        planId: free?.id,
        changes: {
          entitlements: {
            limits: { maxOrganizationsOwned: 2, maxMembersPerOrg: 3 },
            features: [],
          },
        },
        expectedVersion: free?.version,
        reason: 'allow a second org for the trial-once probe',
      },
    });
    expect(raised.status).toBe(200);

    // trial-once: the 2nd org is born with its trial ALREADY consumed
    expect((await createOrg(app, token, 'Second Clinic')).status).toBe(200);
    const mine = (
      (await (await callRpc(app, 'memberships.mine', { token })).json()) as {
        data: ReadonlyArray<{ membershipId: string; accountId: string }>;
      }
    ).data;
    const second = mine.find((m) => m.accountId !== first.accountId);
    expect(second).toBeDefined();
    const switched = await callRpc(app, 'session.switch-account', {
      token,
      body: { membershipId: second?.membershipId },
    });
    expect(switched.status).toBe(200);
    const secondSummary = await callRpc(app, 'billing.summary', {
      token,
      body: { accountId: second?.accountId },
    });
    expect(secondSummary.status).toBe(200);
    // trialEndsAt === startedAt (= the fixed clock): no fresh free window
    expect(await summaryOf(secondSummary)).toMatchObject({
      planKey: 'free',
      phase: 'past_due',
      trialEndsAt: NOW,
    });
  });
});
