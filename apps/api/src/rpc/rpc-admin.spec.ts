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

describe('account.enable', () => {
  it('undoes a disable: the account authorizes again on the next request', async () => {
    const { app } = testRuntime();
    await callRpc(app, 'account.disable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(
      (await callRpc(app, 'access.current', { token: 'session-customer' }))
        .status,
    ).toBe(401);

    const res = await callRpc(app, 'account.enable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);
    // the unexpired session resumes — enable is the undo of disable
    expect(
      (await callRpc(app, 'access.current', { token: 'session-customer' }))
        .status,
    ).toBe(200);

    const audit = await callRpc(app, 'audit.list', { token: 'session-owner' });
    const events = (await audit.json()) as {
      readonly data: ReadonlyArray<{
        readonly event: { readonly type: string };
      }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain('account.enabled');
  });

  it('403s non-owners and 409s an account that is not disabled', async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'account.enable', {
      token: 'session-support',
      body: { accountId: 'acct-customer' },
    });
    expect(denied.status).toBe(403);

    const active = await callRpc(app, 'account.enable', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(active.status).toBe(409);
    expect(await errorTag(active)).toBe('app/account-not-disabled');
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

  it('409s demoting the last administrator of an account', async () => {
    const { app } = testRuntime();
    // membership-owner is the only admin of acct-owner
    const res = await callRpc(app, 'permissions.update', {
      token: 'session-owner',
      body: {
        membershipId: 'membership-owner',
        permissions: [{ action: 'customer.read', scope: 'own' }],
      },
    });
    expect(res.status).toBe(409);
    expect(await errorTag(res)).toBe('app/cannot-orphan-account');
  });
});

describe('POST /rpc/account.promote', () => {
  it('owner promotes a customer account; it leaves the directory', async () => {
    const { app } = testRuntime();
    const before = await callRpc(app, 'customer.search', {
      token: 'session-support',
      body: { query: 'casa' },
    });
    const found = (await before.json()) as { data: ReadonlyArray<unknown> };
    expect(found.data.length).toBeGreaterThan(0);

    const res = await callRpc(app, 'account.promote', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);

    const after = await callRpc(app, 'customer.search', {
      token: 'session-support',
      body: { query: 'casa' },
    });
    const gone = (await after.json()) as { data: ReadonlyArray<unknown> };
    expect(gone.data).toHaveLength(0);
  });

  it('403s non-owners and 409s an already-staff account', async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'account.promote', {
      token: 'session-support',
      body: { accountId: 'acct-customer' },
    });
    expect(denied.status).toBe(403);

    const repeat = await callRpc(app, 'account.promote', {
      token: 'session-owner',
      body: { accountId: 'acct-owner' },
    });
    expect(repeat.status).toBe(409);
    expect(await errorTag(repeat)).toBe('app/account-already-staff');
  });
});

/** The dashboard directory: staff.list (staff.read) + customers.list (customer.search). */
describe('directory listings', () => {
  const ids = async (res: Response) =>
    (
      (await res.json()) as { data: ReadonlyArray<{ accountId: string }> }
    ).data.map((r) => r.accountId);

  it('serves the staff directory to an owner, denies support and customers', async () => {
    const { app } = testRuntime();
    const ok = await callRpc(app, 'staff.list', { token: 'session-owner' });
    expect(ok.status).toBe(200);
    expect((await ids(ok)).sort()).toEqual(['acct-owner', 'acct-support']);

    // staff.read is owner-only: support (a staff account) and customers are denied.
    const support = await callRpc(app, 'staff.list', {
      token: 'session-support',
    });
    expect(support.status).toBe(403);
    const customer = await callRpc(app, 'staff.list', {
      token: 'session-customer',
    });
    expect(customer.status).toBe(403);
    expect(await errorTag(customer)).toBe('app/access-denied');
  });

  it('serves the customer directory to a customer.search holder, denies plain customers', async () => {
    const { app } = testRuntime();
    const ok = await callRpc(app, 'customers.list', { token: 'session-owner' });
    expect(ok.status).toBe(200);
    expect(await ids(ok)).toContain('acct-customer');

    const denied = await callRpc(app, 'customers.list', {
      token: 'session-customer',
    });
    expect(denied.status).toBe(403);
  });
});
