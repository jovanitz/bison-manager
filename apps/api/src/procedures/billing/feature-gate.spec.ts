import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ok } from '@acme/shared';
import type { Plan, SubscriptionId } from '@acme/domain';
import type { InMemoryBillingSeed } from '@acme/infrastructure';
import { defineApiProcedure } from '../../rpc/procedure';
import { SEED_PLAN_FREE, SEED_PLAN_PRO, seedBillingWorld } from '../../seed';
import { callRpc, errorTag, testRuntime } from '../../testing/rpc-harness';

/**
 * Contract of the DECLARATIVE feature gate (ADR-0016 Decision 4): a
 * `feature` on an ApiProcedure is enforced centrally by the pipeline — after
 * actor resolution, before the handler — through the entitlement guards. No
 * production procedure declares one yet, so a test-only probe proves the
 * mechanism. Denials surface the guard's own billing tags, NEVER
 * `app/access-denied`.
 */
const probe = defineApiProcedure({
  name: 'test.premium-probe',
  summary: 'Feature-gate contract probe (test-only, never in production).',
  action: null,
  feature: 'reports.advanced',
  input: z.object({}).strict(),
  handler: async () => ok({ reached: true }),
});

const probeRuntime = (billingSeed?: InMemoryBillingSeed) =>
  testRuntime({
    extraProcedures: [probe],
    ...(billingSeed ? { billingSeed } : {}),
  });

const callProbe = (app: ReturnType<typeof testRuntime>['app'], token: string) =>
  callRpc(app, 'test.premium-probe', { token });

describe('the declarative feature gate', () => {
  it('lets an entitled org through to the handler', async () => {
    const { app } = probeRuntime(
      seedBillingWorld({ customerPlanId: SEED_PLAN_PRO.id }),
    );
    const res = await callProbe(app, 'session-customer');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: unknown }).data).toEqual({
      reached: true,
    });
  });

  it('402s a Free org with the billing tag — never app/access-denied', async () => {
    const { app } = probeRuntime(); // standard world: customer org on Free
    const res = await callProbe(app, 'session-customer');
    expect(res.status).toBe(402);
    expect(await errorTag(res)).toBe('app/feature-not-in-plan');
  });

  it('exempts staff accounts (no subscription, still through)', async () => {
    const { app } = probeRuntime();
    const res = await callProbe(app, 'session-owner');
    expect(res.status).toBe(200);
  });

  it('404s an org with no subscription at all (fail closed for growth)', async () => {
    const { app } = probeRuntime({ plans: [SEED_PLAN_FREE, SEED_PLAN_PRO] });
    const res = await callProbe(app, 'session-customer');
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/subscription-not-found');
  });

  it('402s a held org even when its plan HAS the feature (the hold wins)', async () => {
    const pricedPro: Plan = {
      ...SEED_PLAN_PRO,
      price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
      priceSetAt: '2026-01-01T00:00:00.000Z', // grace long elapsed at TEST_NOW
    };
    const held: InMemoryBillingSeed = {
      plans: [SEED_PLAN_FREE, pricedPro],
      subscriptions: [
        {
          id: 'sub-held' as SubscriptionId,
          accountId: 'acct-customer',
          planId: pricedPro.id,
          createdByUserId: 'user-customer',
          startedAt: '2026-01-01T00:00:00.000Z',
          trialEndsAt: '2026-04-01T00:00:00.000Z', // past_due at TEST_NOW
          paidThroughAt: null,
          canceledAt: null,
          overrides: null,
        },
      ],
    };
    const { app } = probeRuntime(held);
    const res = await callProbe(app, 'session-customer');
    expect(res.status).toBe(402);
    expect(await errorTag(res)).toBe('app/subscription-expired');
  });
});
