import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import type { Role, RoleId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type { AccessAdminRepository } from '../access-admin/ports';
import { expandRoles } from './expand';
import type { RoleStore } from './ports';
import { makeAccessRolesUseCases } from './use-cases';

const makeWorld = (input?: {
  roles?: ReadonlyArray<Role>;
  assignments?: number;
}) => {
  const store = new Map<string, Role>(
    (input?.roles ?? []).map((r) => [r.id, r]),
  );
  const removed: string[] = [];
  // CRUD use cases never touch the admin port; assignment is covered in
  // ./assign.spec.ts with a real fake.
  const admin = {} as unknown as AccessAdminRepository;
  const roles: RoleStore = {
    create: async (role) => {
      store.set(role.id, role);
    },
    list: async (accountId) =>
      [...store.values()].filter(
        (r) => r.accountId === null || r.accountId === accountId,
      ),
    findById: async (id) => store.get(id) ?? null,
    findManyById: async (ids) =>
      ids.flatMap((id) => {
        const r = store.get(id);
        return r ? [r] : [];
      }),
    update: async (id, patch) => {
      const r = store.get(id);
      if (!r) return false;
      store.set(id, { ...r, ...patch, name: patch.name as Role['name'] });
      return true;
    },
    remove: async (id) => {
      removed.push(id);
      store.delete(id);
    },
    countAssignments: async () => input?.assignments ?? 0,
  };
  const useCases = makeAccessRolesUseCases({
    roles,
    admin,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    ids: sequentialIdGenerator('role'),
  });
  return { useCases, store, removed };
};

describe('access roles', () => {
  it('lets an admin create a platform role and persists it', async () => {
    const world = makeWorld();
    const result = await world.useCases.createRole({
      actor: testAccessActor({ preset: 'owner' }),
      name: 'Support',
      accountId: null,
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(world.store.get(result.value.roleId)?.name).toBe('Support');
  });

  it('denies role creation without permissions.update', async () => {
    const result = await makeWorld().useCases.createRole({
      actor: testAccessActor({ preset: 'customer' }),
      name: 'Sneaky',
      accountId: null,
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });

  it('refuses an account-scoped role that holds an any-scoped action', async () => {
    const result = await makeWorld().useCases.createRole({
      actor: testAccessActor({ preset: 'owner' }),
      name: 'Too broad',
      accountId: 'acct-1',
      permissions: [{ action: 'members.read', scope: 'any' }],
    });
    expect(result.ok).toBe(false);
  });

  it('refuses to delete a role that is still assigned', async () => {
    const role = roleFixture('role-x', null);
    const world = makeWorld({ roles: [role], assignments: 3 });
    const result = await world.useCases.deleteRole({
      actor: testAccessActor({ preset: 'owner' }),
      roleId: 'role-x',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/role-in-use');
    expect(world.removed).toEqual([]);
  });

  it('deletes an unassigned role', async () => {
    const role = roleFixture('role-x', null);
    const world = makeWorld({ roles: [role], assignments: 0 });
    const result = await world.useCases.deleteRole({
      actor: testAccessActor({ preset: 'owner' }),
      roleId: 'role-x',
    });
    expect(result.ok).toBe(true);
    expect(world.removed).toEqual(['role-x']);
  });

  it('lists platform roles plus the account’s own roles', async () => {
    const world = makeWorld({
      roles: [roleFixture('r-plat', null), roleFixture('r-acct', 'acct-1')],
    });
    const result = await world.useCases.listRoles({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
    });
    expect(result.ok && result.value.map((r) => r.id).sort()).toEqual([
      'r-acct',
      'r-plat',
    ]);
  });
});

describe('expandRoles', () => {
  it('unions and de-duplicates permissions across roles', () => {
    const a = roleFixture('a', null, [
      { action: 'staff.read', scope: 'any' },
      { action: 'audit.read', scope: 'any' },
    ]);
    const b = roleFixture('b', null, [
      { action: 'staff.read', scope: 'any' }, // duplicate
      { action: 'settings.update', scope: 'any' },
    ]);
    expect(expandRoles([a, b])).toHaveLength(3);
  });
});

const roleFixture = (
  id: string,
  accountId: string | null,
  permissions: ReadonlyArray<{ action: string; scope: string }> = [
    { action: 'staff.read', scope: 'any' },
  ],
): Role => ({
  id: id as RoleId,
  name: id as Role['name'],
  accountId: accountId as Role['accountId'],
  permissions: permissions as Role['permissions'],
});
