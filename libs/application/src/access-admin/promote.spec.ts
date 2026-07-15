import { describe, expect, it } from 'vitest';
import type { AccountId, MembershipId } from '@acme/domain';
import { testAccessActor } from '../access/testing';
import {
  inMemoryAdmin,
  testAdminAccount as account,
  testAdminDeps as deps,
} from './testing';
import { makeAccessAdminUseCases } from './use-cases';

/** A store with one empty-permission customer membership (coherence tests). */
const customerTargetStore = () =>
  inMemoryAdmin({
    memberships: [
      {
        id: 'membership-target' as MembershipId,
        accountId: 'acct-target' as AccountId,
        accountKind: 'customer',
        permissions: [],
      },
    ],
  });

describe('account.promote + permissions coherence', () => {
  it('SECURITY: a customer org owner cannot self-promote to staff (bypass excluded)', async () => {
    // The escalation the adversarial review confirmed: onboarding makes every
    // org creator `isAccountOwner`, and account.promote authorizes against a
    // non-null resource — so without the domain fix the ownership bypass let a
    // customer owner promote their OWN account and then self-grant staff powers.
    const admin = inMemoryAdmin({ accounts: [account('acct-own')] });
    const r = await makeAccessAdminUseCases(deps(admin)).promoteAccountToStaff({
      actor: testAccessActor({
        preset: 'customer',
        accountId: 'acct-own',
        isAccountOwner: true,
      }),
      accountId: 'acct-own', // their OWN account
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(admin.accounts.get('acct-own' as AccountId)?.kind).toBe('customer');
  });

  it('promotes a customer account to staff, audited', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const r = await makeAccessAdminUseCases(deps(admin)).promoteAccountToStaff({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(true);
    expect(admin.accounts.get('acct-x' as AccountId)?.kind).toBe('staff');
    expect(admin.audit.map((e) => e.type)).toEqual(['account.promoted']);
  });

  it('rejects promoting an account that is already staff', async () => {
    const admin = inMemoryAdmin({
      accounts: [{ ...account('acct-x'), kind: 'staff' }],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).promoteAccountToStaff({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-already-staff');
  });

  it('refuses any-scoped permissions on a customer account (promote first)', async () => {
    const admin = customerTargetStore();
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'customer.search', scope: 'any' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/requires-staff-account');
    expect(admin.audit).toHaveLength(0);
  });

  it('refuses staff-only actions on a customer account even with own scope', async () => {
    const admin = customerTargetStore();
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'account.disable', scope: 'own' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/not-delegable-to-customer');
    expect(admin.audit).toHaveLength(0);
  });

  it('allows the delegable org-admin bundle on a customer account', async () => {
    const admin = customerTargetStore();
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [
        { action: 'members.invite', scope: 'own' },
        { action: 'permissions.update', scope: 'own' },
        { action: 'sessions.revoke', scope: 'own' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(admin.audit.map((e) => e.type)).toEqual(['permissions.updated']);
  });
});

describe('account.demote + permission strip', () => {
  it('demotes a staff account to customer, audited', async () => {
    const admin = inMemoryAdmin({
      accounts: [{ ...account('acct-x'), kind: 'staff' }],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).demoteAccountToCustomer(
      {
        actor: testAccessActor({ preset: 'owner' }),
        accountId: 'acct-x',
      },
    );
    expect(r.ok).toBe(true);
    expect(admin.accounts.get('acct-x' as AccountId)?.kind).toBe('customer');
    expect(admin.audit.map((e) => e.type)).toEqual(['account.demoted']);
  });

  it('rejects demoting an account that is already customer', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] }); // customer
    const r = await makeAccessAdminUseCases(deps(admin)).demoteAccountToCustomer(
      {
        actor: testAccessActor({ preset: 'owner' }),
        accountId: 'acct-x',
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-already-customer');
  });

  it('refuses to demote the root account (super-admin protection)', async () => {
    const admin = inMemoryAdmin({
      accounts: [{ ...account('acct-root'), kind: 'staff', hostsRoot: true }],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).demoteAccountToCustomer(
      {
        actor: testAccessActor({ preset: 'owner' }),
        accountId: 'acct-root',
      },
    );
    expect(r.ok).toBe(false);
    // loadAuthorizedAccount's root guard fires first with the generic denial.
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(admin.accounts.get('acct-root' as AccountId)?.kind).toBe('staff');
  });

  it('SECURITY: a customer org owner cannot self-demote-adjacent — demote is bypass-excluded', async () => {
    const admin = inMemoryAdmin({
      accounts: [{ ...account('acct-own'), kind: 'staff' }],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).demoteAccountToCustomer(
      {
        actor: testAccessActor({
          preset: 'customer',
          accountId: 'acct-own',
          isAccountOwner: true,
        }),
        accountId: 'acct-own',
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });
});
