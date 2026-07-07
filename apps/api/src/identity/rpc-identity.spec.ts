import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { createApiRuntime } from '../composition-root';
import { callRpc } from '../testing/rpc-harness';
import type { TestApp } from '../testing/rpc-harness';

/**
 * End-to-end identity flow against the real JWT pipeline (in-memory store):
 * signed Supabase-shaped tokens, first-contact onboarding, owner bootstrap,
 * and immediate revocation — no Docker required.
 */
const SECRET = 'test-secret-at-least-32-characters-long!';
const OWNER_EMAIL = 'owner@example.com';

const identityRuntime = () =>
  createApiRuntime({
    seed: {},
    jwtSecret: SECRET,
    bootstrapOwnerEmail: OWNER_EMAIL,
  });

const tokenFor = (input: {
  userId: string;
  sessionId: string;
  email: string | null;
}) =>
  sign(
    {
      sub: input.userId,
      session_id: input.sessionId,
      aud: 'authenticated',
      ...(input.email === null ? {} : { email: input.email }),
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

describe('identity pipeline (Supabase-shaped JWTs)', () => {
  it('bootstraps the first owner on first contact and audits it', async () => {
    const { app } = identityRuntime();
    const token = await ownerToken();

    const current = await callRpc(app, 'access.current', { token });
    expect(current.status).toBe(200);
    const body = (await current.json()) as {
      data: { permissions: ReadonlyArray<{ action: string; scope: string }> };
    };
    expect(body.data.permissions).toContainEqual({
      action: 'permissions.update',
      scope: 'any',
    });

    const audit = await callRpc(app, 'audit.list', { token, body: {} });
    expect(audit.status).toBe(200);
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    expect(events.data.map((r) => r.event.type)).toEqual([
      'owner.bootstrapped',
      'login.succeeded',
    ]);
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

  it('leaves an unknown identity org-less until it creates its own org (then customer-admin)', async () => {
    const { app } = identityRuntime();
    await callRpc(app, 'access.current', { token: await ownerToken() });

    const token = await tokenFor({
      userId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      email: 'customer@example.com',
    });
    // org-less: no membership ⇒ the actor path 401s.
    expect((await callRpc(app, 'access.current', { token })).status).toBe(401);

    // creates its own org → becomes its admin.
    expect((await createOrg(app, token, 'My Org')).status).toBe(200);

    const current = await callRpc(app, 'access.current', { token });
    expect(current.status).toBe(200);
    const body = (await current.json()) as {
      data: { permissions: ReadonlyArray<{ action: string; scope: string }> };
    };
    expect(body.data.permissions).toContainEqual({
      action: 'members.invite',
      scope: 'own',
    });
    expect(body.data.permissions).not.toContainEqual({
      action: 'permissions.update',
      scope: 'any',
    });
  });

  it('revocation cuts off a live JWT immediately', async () => {
    const { app } = identityRuntime();
    const owner = await ownerToken();
    const customerSessionId = crypto.randomUUID();
    const customer = await tokenFor({
      userId: crypto.randomUUID(),
      sessionId: customerSessionId,
      email: 'customer@example.com',
    });

    expect(
      (await callRpc(app, 'access.current', { token: owner })).status,
    ).toBe(200);
    // org-less customer creates an org, then its session resolves.
    expect((await createOrg(app, customer, 'Org')).status).toBe(200);
    expect(
      (await callRpc(app, 'access.current', { token: customer })).status,
    ).toBe(200);

    const revoked = await callRpc(app, 'sessions.revoke', {
      token: owner,
      body: { sessionId: customerSessionId },
    });
    expect(revoked.status).toBe(200);

    // Same still-valid JWT — but the session row says revoked: 401.
    expect(
      (await callRpc(app, 'access.current', { token: customer })).status,
    ).toBe(401);
  });

  it('an invited email joins the inviting account on first login', async () => {
    const { app } = identityRuntime();
    const owner = await ownerToken();
    const current = await callRpc(app, 'access.current', { token: owner });
    const { data } = (await current.json()) as { data: { accountId: string } };

    const invited = await callRpc(app, 'members.invite', {
      token: owner,
      body: {
        accountId: data.accountId,
        email: 'Invitee@Example.com',
        permissions: [{ action: 'audit.read', scope: 'any' }],
      },
    });
    expect(invited.status).toBe(200);

    // First login of the invited email: no new account, the owner's instead.
    const invitee = await tokenFor({
      userId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      email: 'invitee@example.com',
    });
    const inviteeCurrent = await callRpc(app, 'access.current', {
      token: invitee,
    });
    expect(inviteeCurrent.status).toBe(200);
    const inviteeBody = (await inviteeCurrent.json()) as {
      data: {
        accountId: string;
        permissions: ReadonlyArray<{ action: string; scope: string }>;
      };
    };
    expect(inviteeBody.data.accountId).toBe(data.accountId);
    expect(inviteeBody.data.permissions).toEqual([
      { action: 'audit.read', scope: 'any' },
    ]);

    const audit = await callRpc(app, 'audit.list', { token: owner, body: {} });
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain(
      'invitation.created',
    );
    expect(events.data.map((r) => r.event.type)).toContain(
      'invitation.accepted',
    );
  });

  it('rejects unsigned, foreign-signed and malformed tokens with a plain 401', async () => {
    const { app } = identityRuntime();
    const foreign = await sign(
      {
        sub: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'another-secret-32-characters-long!!',
    );
    for (const token of [foreign, 'garbage', '']) {
      const res = await callRpc(app, 'access.current', { token });
      expect(res.status).toBe(401);
    }
  });
});

// The ADR-0016 org-creation enforcement E2E (plan limits, trial-once) lives
// in ../procedures/billing/create-org-enforcement.spec.ts.
