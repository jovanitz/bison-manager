import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Scheduling / cancelling an org deletion through the real HTTP app. Staff-only
 * and reversible; the seeded customer (acct-customer) is the target.
 */
const schedule = (
  app: ReturnType<typeof testRuntime>['app'],
  token: string,
  accountId = 'acct-customer',
) => callRpc(app, 'account.schedule-deletion', { token, body: { accountId } });

const cancel = (
  app: ReturnType<typeof testRuntime>['app'],
  token: string,
  accountId = 'acct-customer',
) => callRpc(app, 'account.cancel-deletion', { token, body: { accountId } });

describe('account deletion lifecycle', () => {
  it('schedules then cancels, both audited; double-schedule and stray-cancel are refused', async () => {
    const { app } = testRuntime();
    expect((await schedule(app, 'session-owner')).status).toBe(200);

    const twice = await schedule(app, 'session-owner');
    expect(twice.status).toBe(409);
    expect(await errorTag(twice)).toBe('app/deletion-already-scheduled');

    expect((await cancel(app, 'session-owner')).status).toBe(200);

    const stray = await cancel(app, 'session-owner');
    expect(stray.status).toBe(409);
    expect(await errorTag(stray)).toBe('app/deletion-not-scheduled');
  });

  it('403s a customer touching the lever (staff-only, bypass-excluded)', async () => {
    const { app } = testRuntime();
    const res = await schedule(app, 'session-customer');
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });
});
