import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import { createRole, findRoleTemplate } from '@acme/domain';
import type { AccountId, Role, RoleId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../../access/testing';
import type { RoleStore } from '../ports';
import { makeInstallDefaults, makeResetRole } from './defaults';

const defaultRole = (
  id: string,
  accountId: string | null,
  templateKey: string,
  name: string,
): Role => {
  const role = createRole({
    id: id as RoleId,
    name,
    accountId: accountId as AccountId | null,
    permissions: [],
    templateKey,
  });
  if (!role.ok) throw new Error('setup');
  return role.value;
};

const makeWorld = (input?: { roles?: ReadonlyArray<Role> }) => {
  const store = new Map((input?.roles ?? []).map((r) => [r.id as string, r]));
  const updated: { id: string; name: string }[] = [];
  const created: Role[] = [];
  const roles = {
    findById: async (id: RoleId) => store.get(id) ?? null,
    list: async (accountId: AccountId | null) =>
      [...store.values()].filter(
        (r) => r.accountId === null || r.accountId === accountId,
      ),
    create: async (role: Role) => {
      store.set(role.id, role);
      created.push(role);
    },
    update: async (id: RoleId, patch: { name: string }) => {
      const r = store.get(id);
      if (!r) return false;
      store.set(id, { ...r, name: patch.name as Role['name'] });
      updated.push({ id, name: patch.name });
      return true;
    },
    findManyById: async () => [],
    remove: async () => undefined,
    countAssignments: async () => 0,
  } as unknown as RoleStore;
  return { roles, store, updated, created };
};

const clock = fixedClock(new Date(TEST_ACCESS_NOW));

describe('reset role (ADR-0012)', () => {
  it('restores a default role to its template name + permissions', async () => {
    const w = makeWorld({
      roles: [defaultRole('r-1', 'acct-1', 'admin', 'Renamed by hand')],
    });
    const reset = makeResetRole({ roles: w.roles, clock });
    const result = await reset({
      actor: testAccessActor({ preset: 'owner' }),
      roleId: 'r-1',
    });
    expect(result.ok).toBe(true);
    expect(w.updated).toEqual([
      { id: 'r-1', name: findRoleTemplate('admin')?.name },
    ]);
  });

  it('refuses to reset a custom role (no template)', async () => {
    const w = makeWorld({
      roles: [defaultRole('r-2', null, 'admin', 'X')].map((r) => ({
        ...r,
        templateKey: null,
      })),
    });
    const reset = makeResetRole({ roles: w.roles, clock });
    const result = await reset({
      actor: testAccessActor({ preset: 'owner' }),
      roleId: 'r-2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/role-not-resettable');
  });

  it('denies reset without permissions.update', async () => {
    const w = makeWorld({
      roles: [defaultRole('r-3', 'acct-1', 'member', 'Member')],
    });
    const reset = makeResetRole({ roles: w.roles, clock });
    const result = await reset({
      actor: testAccessActor({ preset: 'customer' }),
      roleId: 'r-3',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });
});

describe('install defaults (ADR-0012)', () => {
  it('instantiates the org templates, idempotently', async () => {
    const w = makeWorld();
    const install = makeInstallDefaults({
      roles: w.roles,
      ids: sequentialIdGenerator('role'),
    });
    const first = await install('acct-1' as AccountId);
    expect(first.ok && first.value.created).toBe(2); // admin + member
    expect(w.created.map((r) => r.templateKey).sort()).toEqual([
      'admin',
      'member',
    ]);
    const second = await install('acct-1' as AccountId);
    expect(second.ok && second.value.created).toBe(0); // nothing new
  });

  it('instantiates the platform templates for the platform scope', async () => {
    const w = makeWorld();
    const install = makeInstallDefaults({
      roles: w.roles,
      ids: sequentialIdGenerator('role'),
    });
    const result = await install(null);
    expect(result.ok && result.value.created).toBe(1); // support
    expect(w.created[0]?.templateKey).toBe('support');
  });
});
