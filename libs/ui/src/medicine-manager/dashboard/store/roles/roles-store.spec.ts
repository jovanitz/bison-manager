import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { RoleSummaryDto } from '@acme/application';
import { createRolesStore, type RolesStoreDeps } from './roles-store';

const roleDto: RoleSummaryDto = {
  id: 'r_support',
  name: 'Support',
  accountId: null,
  permissions: [{ action: 'staff.read', scope: 'any' }],
  templateKey: null,
  templateSynced: true,
};

const snapshotWith = (permissions: readonly unknown[]) => ({
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

type Over = {
  readonly access?: Record<string, unknown>;
  readonly roles?: Record<string, unknown>;
};

const makeDeps = (over: Over = {}) =>
  ({
    access: over.access ?? {
      currentAccess: async () =>
        ok(snapshotWith([{ action: 'permissions.update', scope: 'any' }])),
    },
    roles: {
      listRoles: async () => ok([roleDto]),
      createRole: async () => ok({ roleId: 'r_new' }),
      updateRole: async () => ok(undefined),
      deleteRole: async () => ok(undefined),
      resetRole: async () => ok(undefined),
      ...(over.roles ?? {}),
    },
  }) as unknown as RolesStoreDeps;

describe('createRolesStore', () => {
  it('load maps the roles and gates management on permissions.update', async () => {
    const store = createRolesStore(makeDeps());
    await store.getState().load();
    expect(store.getState().vm.canManage).toBe(true);
    expect(store.getState().vm.roles[0]?.id).toBe('r_support');
  });

  it('lists roles even without permissions.update, but canManage is false', async () => {
    const store = createRolesStore(
      makeDeps({ access: { currentAccess: async () => ok(snapshotWith([])) } }),
    );
    await store.getState().load();
    expect(store.getState().vm.canManage).toBe(false);
    expect(store.getState().vm.roles).toHaveLength(1);
  });

  it('create dispatches createRole (platform, accountId null) and reloads', async () => {
    const createRole = vi.fn(async () => ok({ roleId: 'r_new' }));
    const store = createRolesStore(makeDeps({ roles: { createRole } }));
    await store.getState().load();
    store.getState().openCreate();
    await store
      .getState()
      .submitForm({
        name: 'Ops',
        permissions: [{ action: 'x.read', scope: 'any' }],
      });
    expect(createRole).toHaveBeenCalledWith({
      name: 'Ops',
      accountId: null,
      permissions: [{ action: 'x.read', scope: 'any' }],
    });
    expect(store.getState().vm.form).toBeUndefined();
  });

  it('edit dispatches updateRole at the row id', async () => {
    const updateRole = vi.fn(async () => ok(undefined));
    const store = createRolesStore(makeDeps({ roles: { updateRole } }));
    await store.getState().load();
    store.getState().openEdit('r_support');
    const draft = store.getState().vm.form?.draft;
    await store.getState().submitForm({ ...draft!, name: 'Support+' });
    expect(updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'r_support', name: 'Support+' }),
    );
  });

  it('delete dispatches deleteRole and closes on success', async () => {
    const deleteRole = vi.fn(async () => ok(undefined));
    const store = createRolesStore(makeDeps({ roles: { deleteRole } }));
    await store.getState().load();
    store.getState().openDelete('r_support');
    await store.getState().confirmDelete();
    expect(deleteRole).toHaveBeenCalledWith('r_support');
    expect(store.getState().vm.pendingDelete).toBeUndefined();
  });

  it('reset dispatches resetRole', async () => {
    const resetRole = vi.fn(async () => ok(undefined));
    const store = createRolesStore(makeDeps({ roles: { resetRole } }));
    await store.getState().load();
    store.getState().openReset('r_support');
    await store.getState().confirmReset();
    expect(resetRole).toHaveBeenCalledWith('r_support');
  });
});
