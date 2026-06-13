import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/** Session lifecycle endpoints: revoke / revoke-all / list / policy update. */
describe('sessions.revoke', () => {
  it('lets a customer revoke their own session, which 401s right after', async () => {
    const { app } = testRuntime();

    const res = await callRpc(app, 'sessions.revoke', {
      token: 'session-customer',
      body: { sessionId: 'session-customer' },
    });
    expect(res.status).toBe(200);

    const next = await callRpc(app, 'access.current', {
      token: 'session-customer',
    });
    expect(next.status).toBe(401);
  });

  it("403s revoking another account's session with own scope, 409s a repeat", async () => {
    const { app } = testRuntime();

    const denied = await callRpc(app, 'sessions.revoke', {
      token: 'session-customer',
      body: { sessionId: 'session-owner' },
    });
    expect(denied.status).toBe(403);

    const repeat = await callRpc(app, 'sessions.revoke', {
      token: 'session-owner',
      body: { sessionId: 'session-revoked' },
    });
    expect(repeat.status).toBe(409);
    expect(await errorTag(repeat)).toBe('app/session-already-revoked');
  });
});

describe('POST /rpc/sessions.revoke-all', () => {
  it('logs the membership out everywhere; the cut is immediate', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'sessions.revoke-all', {
      token: 'session-customer',
      body: { membershipId: 'membership-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { revoked: number } };
    expect(body.data.revoked).toBe(1); // session-revoked was already dead

    const next = await callRpc(app, 'access.current', {
      token: 'session-customer',
    });
    expect(next.status).toBe(401);
  });

  it("403s revoking another membership's sessions with own scope", async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'sessions.revoke-all', {
      token: 'session-customer',
      body: { membershipId: 'membership-owner' },
    });
    expect(res.status).toBe(403);
  });
});

describe('sessions.list', () => {
  it('lets a customer see the sessions of their own membership', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'sessions.list', {
      token: 'session-customer',
      body: { membershipId: 'membership-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: ReadonlyArray<{ readonly id: string; status: string }>;
    };
    expect(body.data.map((s) => s.id).sort()).toEqual([
      'session-customer',
      'session-revoked',
    ]);
  });

  it("403s another membership's sessions with own scope; owner sees any", async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'sessions.list', {
      token: 'session-customer',
      body: { membershipId: 'membership-owner' },
    });
    expect(denied.status).toBe(403);

    const owner = await callRpc(app, 'sessions.list', {
      token: 'session-owner',
      body: { membershipId: 'membership-customer' },
    });
    expect(owner.status).toBe(200);
  });
});

describe('POST /rpc/settings.update', () => {
  const HOUR = 3_600_000;
  const MIN = 60_000;
  // staff idle 2 h: seeded sessions (created one hour before TEST_NOW)
  // survive the shrink, so the owner can still read the audit afterwards.
  const policies = {
    customer: { idleTtlMs: 12 * HOUR, maxLifetimeMs: 48 * HOUR },
    staff: { idleTtlMs: 2 * HOUR, maxLifetimeMs: 8 * HOUR },
  };

  it('lets the owner reconfigure the session policy and audits it', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'settings.update', {
      token: 'session-owner',
      body: { policies },
    });
    expect(res.status).toBe(200);

    const audit = await callRpc(app, 'audit.list', {
      token: 'session-owner',
      body: {},
    });
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain('settings.updated');
  });

  it('rejects out-of-bounds policies with the domain error', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'settings.update', {
      token: 'session-owner',
      body: {
        policies: {
          ...policies,
          staff: { idleTtlMs: 1 * MIN, maxLifetimeMs: 8 * HOUR },
        },
      },
    });
    expect(res.status).toBe(400);
    expect(await errorTag(res)).toBe('domain/invalid-session-policy');
  });

  it('a hard tightening cuts off live sessions immediately', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'settings.update', {
      token: 'session-owner',
      body: {
        policies: {
          ...policies,
          staff: { idleTtlMs: 15 * MIN, maxLifetimeMs: 8 * HOUR },
        },
      },
    });
    expect(res.status).toBe(200);
    // seeded staff sessions were last seen 1 h ago > 15 min idle → dead now
    const next = await callRpc(app, 'access.current', {
      token: 'session-owner',
    });
    expect(next.status).toBe(401);
  });

  it('403s support and customers', async () => {
    const { app } = testRuntime();
    for (const token of ['session-support', 'session-customer']) {
      const res = await callRpc(app, 'settings.update', {
        token,
        body: { policies },
      });
      expect(res.status).toBe(403);
    }
  });
});
