import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { MemberSummaryDto, RoleSummaryDto } from '@acme/application';
import {
  createStaffDetailStore,
  type StaffDetailStoreDeps,
} from './staff-detail-store';

const member: MemberSummaryDto = {
  membershipId: 'mem_support',
  userId: 'support@acme.test',
  permissions: [{ action: 'staff.read', scope: 'any' }],
  roleIds: ['r_support'],
  isRoot: false,
};

const root: MemberSummaryDto = {
  ...member,
  membershipId: 'mem_root',
  userId: 'root@acme.test',
  isRoot: true,
};

const role: RoleSummaryDto = {
  id: 'r_support',
  name: 'Support',
  accountId: null,
  permissions: [{ action: 'staff.read', scope: 'any' }],
  templateKey: 'support',
  templateSynced: true,
};

const snapshot = {
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-staff',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'members.read', scope: 'any' },
    { action: 'permissions.update', scope: 'any' },
  ],
  activeGrants: [],
};

const makeDeps = (over: Record<string, unknown> = {}) =>
  ({
    access: { currentAccess: async () => ok(snapshot) },
    members: {
      listMembers: async () => ok([member, root]),
      updatePermissions: async () => ok(undefined),
    },
    roles: {
      listRoles: async () => ok([role]),
      assignRoles: async () => ok(undefined),
    },
    sessions: { list: async () => ok([]) },
    ...over,
  }) as unknown as StaffDetailStoreDeps;

describe('createStaffDetailStore', () => {
  it('load selects the member by identity and builds the VM', async () => {
    const store = createStaffDetailStore(
      makeDeps(),
      'support@acme.test',
      'acct-staff',
    );
    await store.getState().load();
    const vm = store.getState().vm;
    expect(vm?.member.membershipId).toBe('mem_support');
    expect(vm?.member.roleIds).toEqual(['r_support']);
    expect(vm?.availableRoles).toEqual([{ id: 'r_support', name: 'Support' }]);
    expect(vm?.canEdit).toBe(true); // permissions.update && !isRoot
  });

  it('never offers to edit the protected root member', async () => {
    const store = createStaffDetailStore(
      makeDeps(),
      'root@acme.test',
      'acct-staff',
    );
    await store.getState().load();
    expect(store.getState().vm?.canEdit).toBe(false);
  });

  it('errors when the identity is not a staff member', async () => {
    const store = createStaffDetailStore(
      makeDeps(),
      'ghost@acme.test',
      'acct-staff',
    );
    await store.getState().load();
    expect(store.getState().vm).toBeNull();
    expect(store.getState().error).toContain('not found');
  });

  it('assignRoles dispatches the new role set', async () => {
    const assignRoles = vi.fn(async () => ok(undefined));
    const store = createStaffDetailStore(
      makeDeps({ roles: { listRoles: async () => ok([role]), assignRoles } }),
      'support@acme.test',
      'acct-staff',
    );
    await store.getState().load();
    await store.getState().assignRoles('mem_support', ['r_support', 'r_ops']);
    expect(assignRoles).toHaveBeenCalledWith({
      membershipId: 'mem_support',
      roleIds: ['r_support', 'r_ops'],
    });
  });

  it('grant appends the permission to the member’s current set', async () => {
    const updatePermissions = vi.fn(async () => ok(undefined));
    const store = createStaffDetailStore(
      makeDeps({
        members: {
          listMembers: async () => ok([member, root]),
          updatePermissions,
        },
      }),
      'support@acme.test',
      'acct-staff',
    );
    await store.getState().load();
    await store.getState().grant('mem_support', 'audit.read', 'any');
    expect(updatePermissions).toHaveBeenCalledWith({
      membershipId: 'mem_support',
      permissions: [
        { action: 'staff.read', scope: 'any' },
        { action: 'audit.read', scope: 'any' },
      ],
    });
  });
});
