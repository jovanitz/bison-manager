import { describe, expect, it } from 'vitest';
import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  CustomerDirectory,
  RoleStore,
} from '@acme/application';
import type { AccountId, MembershipId, RoleId, UserId } from '@acme/domain';
import { makeOrgDetailReader } from './access-org-detail-reader';

const ORG = 'acct-customer' as AccountId;

const customers = (
  details: Awaited<ReturnType<CustomerDirectory['read']>>,
): Pick<CustomerDirectory, 'read'> => ({ read: async () => details });

const members: Pick<AccessMemberDirectory, 'listMembers'> = {
  listMembers: async () => [
    {
      membershipId: 'm-owner' as MembershipId,
      userId: 'u-owner' as UserId,
      permissions: [],
      roleIds: ['role-owner' as RoleId],
      isRoot: false,
      blocked: false,
    },
    {
      membershipId: 'm-member' as MembershipId,
      userId: 'u-member' as UserId,
      permissions: [],
      roleIds: ['role-member' as RoleId],
      isRoot: false,
      blocked: true,
    },
  ],
};

const admin: Pick<AccessAdminRepository, 'findMembership'> = {
  findMembership: async (id) =>
    ({
      id,
      accountId: ORG,
      isRoot: false,
      isAccountOwner: id === 'm-owner',
    }) as Awaited<ReturnType<AccessAdminRepository['findMembership']>>,
};

const roles: Pick<RoleStore, 'list'> = {
  list: async (accountId) =>
    accountId === null
      ? [{ id: 'role-owner', name: 'Owner' }]
      : [{ id: 'role-member', name: 'Member' }],
} as Pick<RoleStore, 'list'>;

describe('makeOrgDetailReader', () => {
  it('maps the customer directory entry to an org summary', async () => {
    const reader = makeOrgDetailReader({
      customers: customers({
        accountId: ORG,
        displayName: 'Casa Pampa',
        email: 'ops@casa.example',
        status: 'active',
        createdAt: '2026-01-01',
      }),
      members,
      admin,
      roles,
    });
    expect(await reader.readSummary(ORG)).toEqual({
      accountId: ORG,
      name: 'Casa Pampa',
      email: 'ops@casa.example',
      status: 'active',
      createdAt: '2026-01-01',
    });
  });

  it('returns null summary for an unknown account', async () => {
    const reader = makeOrgDetailReader({
      customers: customers(null),
      members,
      admin,
      roles,
    });
    expect(await reader.readSummary(ORG)).toBeNull();
  });

  it('enriches the roster with role names + ownership (display fields null in-memory)', async () => {
    const reader = makeOrgDetailReader({
      customers: customers(null),
      members,
      admin,
      roles,
    });
    const roster = await reader.listMembers(ORG);
    expect(roster).toEqual([
      {
        membershipId: 'm-owner',
        userId: 'u-owner',
        displayName: null,
        email: null,
        roleNames: ['Owner'],
        isAccountOwner: true,
        isRoot: false,
        blocked: false,
      },
      {
        membershipId: 'm-member',
        userId: 'u-member',
        displayName: null,
        email: null,
        roleNames: ['Member'],
        isAccountOwner: false,
        isRoot: false,
        blocked: true,
      },
    ]);
  });
});
