import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Demoting a staff account back to customer through the real HTTP app. The
 * seeded owner (acct-owner) is staff; support (acct-support) is staff too.
 * Root protection and the owner-only + bypass-excluded authorization are the
 * properties worth pinning.
 */
describe('account.demote', () => {
  it('demotes a staff account to customer for an owner', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'account.demote', {
      token: 'session-owner',
      body: { accountId: 'acct-support' },
    });
    expect(res.status).toBe(200);

    // Idempotence guard: it is a customer now, so a second demote is refused.
    const again = await callRpc(app, 'account.demote', {
      token: 'session-owner',
      body: { accountId: 'acct-support' },
    });
    expect(again.status).toBe(409);
    expect(await errorTag(again)).toBe('app/account-already-customer');
  });

  it('403s a customer touching the lever (owner-only, bypass-excluded)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'account.demote', {
      token: 'session-customer',
      body: { accountId: 'acct-support' },
    });
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });
});
