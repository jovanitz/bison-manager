import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Contract tests for the pipeline itself — 401 (no valid session), 403
 * (policy denial), 200, and the 400/404 edges — end-to-end through the real
 * composition root. Per-procedure contracts live in rpc-admin.spec.ts and
 * rpc-impersonation.spec.ts.
 */
describe('the rpc pipeline', () => {
  it('401s without a token, with an unknown token, and with a revoked session', async () => {
    const { app } = testRuntime();
    for (const token of [undefined, 'session-nope', 'session-revoked']) {
      const res = await callRpc(app, 'access.current', token ? { token } : {});
      expect(res.status).toBe(401);
      expect(await errorTag(res)).toBe('api/unauthorized');
    }
  });

  it('200s with the access snapshot for a valid session', async () => {
    const res = await callRpc(testRuntime().app, 'access.current', {
      token: 'session-customer',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: {
        readonly accountId: string;
        readonly permissions: ReadonlyArray<unknown>;
      };
    };
    expect(body.data.accountId).toBe('acct-customer');
    expect(body.data.permissions).toContainEqual({
      action: 'customer.read',
      scope: 'own',
    });
  });

  it('403s when the policy denies the declared action', async () => {
    const res = await callRpc(testRuntime().app, 'audit.list', {
      token: 'session-customer',
    });

    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });

  it('200s for an actor whose permissions allow the action', async () => {
    const res = await callRpc(testRuntime().app, 'audit.list', {
      token: 'session-owner',
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: unknown }).data).toEqual([]);
  });

  it('400s input that fails the procedure schema', async () => {
    const res = await callRpc(testRuntime().app, 'audit.list', {
      token: 'session-owner',
      body: { limit: 0 },
    });

    expect(res.status).toBe(400);
    expect(await errorTag(res)).toBe('api/invalid-input');
  });

  it('404s a procedure that was never declared', async () => {
    const res = await callRpc(testRuntime().app, 'nope.nothing', {
      token: 'session-owner',
    });

    expect(res.status).toBe(404);
  });

  it('declares every access capability in the registry', () => {
    expect(
      testRuntime()
        .procedures.map((p) => p.name)
        .sort(),
    ).toEqual([
      'access.current',
      'account.disable',
      'account.enable',
      'account.promote',
      'audit.list',
      'customer.read',
      'customer.search',
      'customers.list',
      'identity.block',
      'identity.unblock',
      'impersonation.end',
      'impersonation.start',
      'members.block',
      'members.invite',
      'members.list',
      'members.remove',
      'members.unblock',
      'memberships.mine',
      'org.block',
      'org.unblock',
      'permissions.update',
      'session.switch-account',
      'sessions.list',
      'sessions.revoke',
      'sessions.revoke-all',
      'settings.update',
      'staff.list',
    ]);
  });
});
