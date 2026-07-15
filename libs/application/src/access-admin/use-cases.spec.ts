import { describe, expect, it } from 'vitest';
import type { AccountId, MembershipId } from '@acme/domain';
import { testAccessActor } from '../access/testing';
import type { AdminMembershipSnapshot } from './ports';
import {
  inMemoryAdmin,
  testAdminAccount as account,
  testAdminDeps as deps,
} from './testing';
import { makeAccessAdminUseCases } from './use-cases';

describe('disableAccount', () => {
  it('lets an owner disable an account and audits it atomically', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const uc = makeAccessAdminUseCases(deps(admin));
    const r = await uc.disableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
      reason: 'fraud review',
    });
    expect(r.ok).toBe(true);
    expect(admin.accounts.get('acct-x' as AccountId)?.status).toBe('disabled');
    expect(admin.audit).toHaveLength(1);
    expect(admin.audit[0]?.type).toBe('account.disabled');
  });

  it('denies support and customers', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const uc = makeAccessAdminUseCases(deps(admin));
    for (const preset of ['support', 'customer'] as const) {
      const r = await uc.disableAccount({
        actor: testAccessActor({ preset }),
        accountId: 'acct-x',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
    expect(admin.audit).toHaveLength(0);
  });

  it('rejects disabling an already-disabled account', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x', 'disabled')] });
    const r = await makeAccessAdminUseCases(deps(admin)).disableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-already-disabled');
  });
});

describe('enableAccount', () => {
  it('re-enables a disabled account and audits it', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x', 'disabled')] });
    const r = await makeAccessAdminUseCases(deps(admin)).enableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(true);
    expect(admin.accounts.get('acct-x' as AccountId)?.status).toBe('active');
    expect(admin.audit.map((e) => e.type)).toEqual(['account.enabled']);
  });

  it('rejects enabling an account that is not disabled', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const r = await makeAccessAdminUseCases(deps(admin)).enableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-not-disabled');
    expect(admin.audit).toHaveLength(0);
  });

  it('denies support and customers', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x', 'disabled')] });
    for (const preset of ['support', 'customer'] as const) {
      const r = await makeAccessAdminUseCases(deps(admin)).enableAccount({
        actor: testAccessActor({ preset }),
        accountId: 'acct-x',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
  });
});

describe('updateUserPermissions', () => {
  const membership = (): AdminMembershipSnapshot => ({
    id: 'membership-target' as MembershipId,
    accountId: 'acct-target' as AccountId,
    accountKind: 'staff',
    permissions: [{ action: 'customer.read', scope: 'own' }],
  });

  it('replaces permissions and audits before/after', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'audit.read', scope: 'any' }],
    });
    expect(r.ok).toBe(true);
    const event = admin.audit[0];
    expect(event?.type).toBe('permissions.updated');
    if (event?.type === 'permissions.updated') {
      expect(event.before).toEqual([{ action: 'customer.read', scope: 'own' }]);
      expect(event.after).toEqual([{ action: 'audit.read', scope: 'any' }]);
    }
  });

  it('rejects unknown actions and scopes at the boundary', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const uc = makeAccessAdminUseCases(deps(admin));
    const badAction = await uc.updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'database.drop', scope: 'any' }],
    });
    expect(badAction.ok).toBe(false);
    if (!badAction.ok)
      expect(badAction.error.tag).toBe('domain/invalid-access-action');
    expect(admin.audit).toHaveLength(0);
  });

  it('denies non-owners', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'support' }),
      membershipId: 'membership-target',
      permissions: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });

  const admin = (id: string, accountId: string): AdminMembershipSnapshot => ({
    id: id as MembershipId,
    accountId: accountId as AccountId,
    accountKind: 'customer',
    permissions: [{ action: 'permissions.update', scope: 'own' }],
  });

  it('refuses demoting the last administrator of an account', async () => {
    const store = inMemoryAdmin({ memberships: [admin('m-only', 'acct-x')] });
    const r = await makeAccessAdminUseCases(deps(store)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm-only',
      permissions: [{ action: 'customer.read', scope: 'own' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/cannot-orphan-account');
    expect(store.audit).toHaveLength(0);
  });

  it('allows demoting an admin while another remains', async () => {
    const store = inMemoryAdmin({
      memberships: [admin('m1', 'acct-x'), admin('m2', 'acct-x')],
    });
    const r = await makeAccessAdminUseCases(deps(store)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm1',
      permissions: [{ action: 'customer.read', scope: 'own' }],
    });
    expect(r.ok).toBe(true);
    expect(store.audit.map((e) => e.type)).toEqual(['permissions.updated']);
  });
});
