import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type { AccessMemberRemoved, MembershipId, UserId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import {
  inMemoryAdmin,
  testAdminAccount as account,
} from '../access-admin/testing';
import type { AccessMemberSnapshot } from './ports';
import { makeAccessMembersUseCases } from './use-cases';

const member = (id: string): AccessMemberSnapshot => ({
  membershipId: id as MembershipId,
  userId: `user-${id}` as UserId,
  permissions: [{ action: 'customer.read', scope: 'own' }],
});

const unusedSwitcher = async () => {
  throw new Error('switcher is exercised in membership-switch.spec.ts');
};

const makeWorld = (input: {
  accounts?: Parameters<typeof inMemoryAdmin>[0]['accounts'];
  memberships?: Parameters<typeof inMemoryAdmin>[0]['memberships'];
  members?: Record<string, ReadonlyArray<AccessMemberSnapshot>>;
}) => {
  const admin = inMemoryAdmin({
    ...(input.accounts ? { accounts: input.accounts } : {}),
    ...(input.memberships ? { memberships: input.memberships } : {}),
  });
  const removed: AccessMemberRemoved[] = [];
  const useCases = makeAccessMembersUseCases({
    members: {
      listMembers: async (accountId) => input.members?.[accountId] ?? [],
      // mirrors the adapter's atomic anti-orphan check over seeded memberships
      removeMember: async (membershipId, event, requireCoAdmin) => {
        const hasCoAdmin = [...admin.memberships].some(
          ([id, m]) =>
            id !== membershipId &&
            m.accountId === event.accountId &&
            m.permissions.some((p) => p.action === 'permissions.update'),
        );
        if (requireCoAdmin && !hasCoAdmin) return { orphaned: true };
        removed.push(event);
        return { orphaned: false };
      },
      listMembershipsByUser: unusedSwitcher,
      switchSession: unusedSwitcher,
    },
    accounts: admin.port,
    sessionPolicies: {
      loadSessionPolicies: async () => ACCESS_SESSION_POLICY_DEFAULTS,
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { useCases, removed };
};

const targetMembership = {
  id: 'membership-target' as MembershipId,
  accountId: 'acct-1' as AccountId,
  accountKind: 'customer' as const,
  permissions: [],
};

describe('listMembers', () => {
  it('lets an organization admin list the members of their own account', async () => {
    const world = makeWorld({
      accounts: [account('acct-1')],
      members: { 'acct-1': [member('m1'), member('m2')] },
    });
    const r = await world.useCases.listMembers({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      accountId: 'acct-1',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((m) => m.membershipId)).toEqual(['m1', 'm2']);
  });

  it("denies another account's members with own scope; plain customers entirely", async () => {
    const world = makeWorld({ accounts: [account('acct-other')] });
    for (const actor of [
      testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      testAccessActor({ preset: 'customer', accountId: 'acct-other' }),
    ]) {
      const r = await world.useCases.listMembers({
        actor,
        accountId: 'acct-other',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
  });

  it('404s an unknown account', async () => {
    const world = makeWorld({});
    const r = await world.useCases.listMembers({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: crypto.randomUUID(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-not-found');
  });
});

describe('removeMember', () => {
  it('lets an org admin remove a member of their own account, audited', async () => {
    const world = makeWorld({ memberships: [targetMembership] });
    const r = await world.useCases.removeMember({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      membershipId: 'membership-target',
    });
    expect(r.ok).toBe(true);
    expect(world.removed).toHaveLength(1);
    expect(world.removed[0]).toMatchObject({
      type: 'member.removed',
      membershipId: 'membership-target',
      accountId: 'acct-1',
      actorMembershipId: 'membership-1',
    });
  });

  it('refuses removing your own membership', async () => {
    const world = makeWorld({
      memberships: [
        { ...targetMembership, id: 'membership-1' as MembershipId },
      ],
    });
    const r = await world.useCases.removeMember({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      membershipId: 'membership-1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/cannot-remove-self');
    expect(world.removed).toHaveLength(0);
  });

  const adminMember = (id: string) => ({
    id: id as MembershipId,
    accountId: 'acct-1' as AccountId,
    accountKind: 'customer' as const,
    permissions: [
      { action: 'permissions.update' as const, scope: 'own' as const },
    ],
  });

  it("refuses removing the account's last administrator", async () => {
    const world = makeWorld({ memberships: [adminMember('m-admin')] });
    const r = await world.useCases.removeMember({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      membershipId: 'm-admin',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/cannot-orphan-account');
    expect(world.removed).toHaveLength(0);
  });

  it('removes an admin while another remains', async () => {
    const world = makeWorld({
      memberships: [adminMember('m-admin'), adminMember('m-other')],
    });
    const r = await world.useCases.removeMember({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'acct-1' }),
      membershipId: 'm-admin',
    });
    expect(r.ok).toBe(true);
    expect(world.removed).toHaveLength(1);
  });

  it('denies plain customers and cross-account org admins; 404s unknown', async () => {
    const world = makeWorld({ memberships: [targetMembership] });
    for (const actor of [
      testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      testAccessActor({ preset: 'customer-admin', accountId: 'acct-2' }),
    ]) {
      const r = await world.useCases.removeMember({
        actor,
        membershipId: 'membership-target',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
    const missing = await world.useCases.removeMember({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-nope',
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.tag).toBe('app/membership-not-found');
  });
});
