import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccountId, MembershipId, Role, RoleId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type {
  AccessAdminRepository,
  AdminMembershipSnapshot,
} from '../access-admin/ports';
import type { RoleStore } from './ports';
import { makeAssignMemberRoles } from './assign';

const roleFixture = (id: string, accountId: string | null): Role => ({
  id: id as RoleId,
  name: id as Role['name'],
  accountId: accountId as Role['accountId'],
  permissions: [{ action: 'staff.read', scope: 'any' }] as Role['permissions'],
});

const membershipFixture = (
  accountId: string,
  extra: { readonly isRoot?: boolean; readonly isAccountOwner?: boolean } = {},
): AdminMembershipSnapshot => ({
  id: 'm-1' as MembershipId,
  accountId: accountId as AccountId,
  accountKind: 'customer',
  permissions: [],
  isRoot: extra.isRoot ?? false,
  isAccountOwner: extra.isAccountOwner ?? false,
});

const makeWorld = (input: {
  roles?: ReadonlyArray<Role>;
  membership: AdminMembershipSnapshot | null;
}) => {
  const store = new Map((input.roles ?? []).map((r) => [r.id as string, r]));
  const assigned: { membershipId: string; roleIds: readonly string[] }[] = [];
  const roles = {
    findManyById: async (ids: ReadonlyArray<RoleId>) =>
      ids.flatMap((id) => {
        const role = store.get(id);
        return role ? [role] : [];
      }),
  } as unknown as RoleStore;
  const admin = {
    findMembership: async () => input.membership,
    assignRoles: async (id: string, roleIds: ReadonlyArray<string>) => {
      assigned.push({ membershipId: id, roleIds });
    },
  } as unknown as AccessAdminRepository;
  const assignMemberRoles = makeAssignMemberRoles({
    roles,
    admin,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { assignMemberRoles, assigned };
};

describe('assign member roles', () => {
  it('assigns platform + own-account roles, de-duplicated', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-plat', null), roleFixture('r-acct', 'acct-1')],
      membership: membershipFixture('acct-1'),
    });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm-1',
      roleIds: ['r-plat', 'r-acct', 'r-plat'],
    });
    expect(result.ok).toBe(true);
    expect(world.assigned).toEqual([
      { membershipId: 'm-1', roleIds: ['r-plat', 'r-acct'] },
    ]);
  });

  it('refuses a role that belongs to another account', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-other', 'acct-2')],
      membership: membershipFixture('acct-1'),
    });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm-1',
      roleIds: ['r-other'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/role-not-found');
    expect(world.assigned).toEqual([]);
  });

  it('refuses a non-existent role', async () => {
    const world = makeWorld({ membership: membershipFixture('acct-1') });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm-1',
      roleIds: ['ghost'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/role-not-found');
  });

  it('denies an actor without permissions.update', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-plat', null)],
      membership: membershipFixture('acct-1'),
    });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'customer' }),
      membershipId: 'm-1',
      roleIds: ['r-plat'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.assigned).toEqual([]);
  });

  it('404s an unknown membership', async () => {
    const world = makeWorld({ membership: null });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'm-x',
      roleIds: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/membership-not-found');
  });

  it('protects the account owner from a same-account non-owner peer', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-plat', null)],
      membership: membershipFixture('acct-1', { isAccountOwner: true }),
    });
    // a peer with the owner's permissions but isAccountOwner=false
    const result = await world.assignMemberRoles({
      actor: testAccessActor({ preset: 'owner', accountId: 'acct-1' }),
      membershipId: 'm-1',
      roleIds: ['r-plat'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.assigned).toEqual([]);
  });

  it('lets a fellow owner of the same account reassign the owner', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-plat', null)],
      membership: membershipFixture('acct-1', { isAccountOwner: true }),
    });
    const result = await world.assignMemberRoles({
      actor: testAccessActor({
        preset: 'owner',
        accountId: 'acct-1',
        isAccountOwner: true,
      }),
      membershipId: 'm-1',
      roleIds: ['r-plat'],
    });
    expect(result.ok).toBe(true);
  });
});
