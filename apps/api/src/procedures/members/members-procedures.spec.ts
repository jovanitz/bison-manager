import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../../testing/rpc-harness';

describe('members.list', () => {
  it('lets the owner list the members of any account', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'members.list', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: ReadonlyArray<{ readonly membershipId: string }>;
    };
    expect(body.data.map((m) => m.membershipId)).toEqual([
      'membership-customer',
    ]);
  });

  it('403s a plain customer (no members.read) and 404s unknown accounts', async () => {
    const { app } = testRuntime();
    const denied = await callRpc(app, 'members.list', {
      token: 'session-customer',
      body: { accountId: 'acct-customer' },
    });
    expect(denied.status).toBe(403);

    const missing = await callRpc(app, 'members.list', {
      token: 'session-owner',
      body: { accountId: 'acct-nope' },
    });
    expect(missing.status).toBe(404);
  });
});

describe('members.remove', () => {
  it('removes the member; their live session 401s immediately', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'members.remove', {
      token: 'session-owner',
      body: { membershipId: 'membership-customer' },
    });
    expect(res.status).toBe(200);

    expect(
      (await callRpc(app, 'access.current', { token: 'session-customer' }))
        .status,
    ).toBe(401);

    const audit = await callRpc(app, 'audit.list', { token: 'session-owner' });
    const events = (await audit.json()) as {
      readonly data: ReadonlyArray<{
        readonly event: { readonly type: string };
      }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain('member.removed');
  });

  it('409s removing yourself, 403s non-holders', async () => {
    const { app } = testRuntime();
    const self = await callRpc(app, 'members.remove', {
      token: 'session-owner',
      body: { membershipId: 'membership-owner' },
    });
    expect(self.status).toBe(409);
    expect(await errorTag(self)).toBe('app/cannot-remove-self');

    const denied = await callRpc(app, 'members.remove', {
      token: 'session-customer',
      body: { membershipId: 'membership-customer' },
    });
    expect(denied.status).toBe(403);
  });
});
