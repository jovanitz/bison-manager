import { describe, expect, it } from 'vitest';
import { testAccessActor } from '../../access/testing';
import {
  inMemoryAdmin,
  testAdminAccount as account,
  testAdminDeps as deps,
} from '../testing';
import { makeAccessAdminUseCases } from '../use-cases';

const uc = (admin: ReturnType<typeof inMemoryAdmin>) =>
  makeAccessAdminUseCases(deps(admin));

describe('schedule / cancel account deletion', () => {
  it('schedules a deletion, audited, and reports the pending window', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const r = await uc(admin).scheduleAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(true);
    expect(admin.audit.map((e) => e.type)).toEqual([
      'account.deletion-scheduled',
    ]);
    // the account now carries a purge date
    const snap = await admin.port.findAccount('acct-x' as never);
    expect(snap?.pendingDeletionUntil).not.toBeNull();
  });

  it('rejects scheduling twice (already scheduled)', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    await uc(admin).scheduleAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    const again = await uc(admin).scheduleAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.tag).toBe('app/deletion-already-scheduled');
  });

  it('cancel restores the account; cancelling an unscheduled one is refused', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const early = await uc(admin).cancelAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error.tag).toBe('app/deletion-not-scheduled');

    await uc(admin).scheduleAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    const cancelled = await uc(admin).cancelAccountDeletion({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(cancelled.ok).toBe(true);
    const snap = await admin.port.findAccount('acct-x' as never);
    expect(snap?.pendingDeletionUntil).toBeNull();
  });

  it('SECURITY: a customer org owner cannot schedule their own deletion (bypass-excluded)', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-own')] });
    const r = await uc(admin).scheduleAccountDeletion({
      actor: testAccessActor({
        preset: 'customer',
        accountId: 'acct-own',
        isAccountOwner: true,
      }),
      accountId: 'acct-own',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });
});
