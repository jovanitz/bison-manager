import { describe, expect, it } from 'vitest';
import { callRpc, testRuntime } from '../../testing/rpc-harness';

describe('org.summary', () => {
  it('returns a customer org summary to a customer.search holder (owner)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'org.summary', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: { readonly name: string; readonly status: string };
    };
    expect(body.data.name).toBe('Casa Pampa');
  });

  it('403s a plain customer (no customer.search) and 404s unknown accounts', async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'org.summary', {
      token: 'session-customer',
      body: { accountId: 'acct-customer' },
    });
    expect(denied.status).toBe(403);

    const missing = await callRpc(app, 'org.summary', {
      token: 'session-owner',
      body: { accountId: 'acct-nope' },
    });
    expect(missing.status).toBe(404);
  });
});

describe('org.members', () => {
  it('returns the roster to a members.read holder (owner) for any org', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'org.members', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: ReadonlyArray<{ readonly membershipId: string }>;
    };
    expect(body.data.map((m) => m.membershipId)).toContain(
      'membership-customer',
    );
  });

  it('403s a plain customer without members.read', async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'org.members', {
      token: 'session-customer',
      body: { accountId: 'acct-customer' },
    });
    expect(denied.status).toBe(403);
  });
});
