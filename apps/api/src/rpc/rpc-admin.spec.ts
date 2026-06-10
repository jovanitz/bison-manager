import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Per-endpoint contracts for the admin procedures, including the property
 * the whole design exists for: a disable/revoke is enforced on the very next
 * request, and every mutation leaves an audit event.
 */
describe('account.disable', () => {
  it('disables the account, denies its sessions immediately, and audits it', async () => {
    const { app } = testRuntime();

    const res = await callRpc(app, 'account.disable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer', reason: 'fraud review' },
    });
    expect(res.status).toBe(200);

    const next = await callRpc(app, 'access.current', {
      token: 'session-customer',
    });
    expect(next.status).toBe(401);

    const audit = await callRpc(app, 'audit.list', { token: 'session-owner' });
    const events = (await audit.json()) as {
      readonly data: ReadonlyArray<{
        readonly event: { readonly type: string };
      }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain('account.disabled');
  });

  it('403s a customer, 404s an unknown account, 409s a repeat', async () => {
    const { app } = testRuntime();

    const denied = await callRpc(app, 'account.disable', {
      token: 'session-customer',
      body: { accountId: 'acct-support' },
    });
    expect(denied.status).toBe(403);

    const missing = await callRpc(app, 'account.disable', {
      token: 'session-owner',
      body: { accountId: 'acct-nope' },
    });
    expect(missing.status).toBe(404);
    expect(await errorTag(missing)).toBe('app/account-not-found');

    await callRpc(app, 'account.disable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    const repeat = await callRpc(app, 'account.disable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(repeat.status).toBe(409);
    expect(await errorTag(repeat)).toBe('app/account-already-disabled');
  });
});

describe('permissions.update', () => {
  it('replaces the permission list and the actor sees it immediately', async () => {
    const { app } = testRuntime();

    const res = await callRpc(app, 'permissions.update', {
      token: 'session-owner',
      body: { membershipId: 'membership-customer', permissions: [] },
    });
    expect(res.status).toBe(200);

    const snapshot = await callRpc(app, 'access.current', {
      token: 'session-customer',
    });
    const body = (await snapshot.json()) as {
      readonly data: { readonly permissions: ReadonlyArray<unknown> };
    };
    expect(body.data.permissions).toEqual([]);
  });

  it('400s a permission that violates the domain, 404s an unknown membership', async () => {
    const { app } = testRuntime();

    const invalid = await callRpc(app, 'permissions.update', {
      token: 'session-owner',
      body: {
        membershipId: 'membership-customer',
        permissions: [{ action: 'customer.read', scope: 'galaxy' }],
      },
    });
    expect(invalid.status).toBe(400);
    expect(await errorTag(invalid)).toBe('domain/invalid-access-scope');

    const missing = await callRpc(app, 'permissions.update', {
      token: 'session-owner',
      body: { membershipId: 'membership-nope', permissions: [] },
    });
    expect(missing.status).toBe(404);
  });
});

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
