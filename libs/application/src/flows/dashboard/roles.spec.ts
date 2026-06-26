import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { RolesGateway } from '../../access-client/roles-ports';
import {
  applyTemplateToAll,
  assignMemberRoles,
  createPlatformRole,
  deletePlatformRole,
  loadDefaultTemplates,
  loadPlatformRoles,
  resetDefaultTemplate,
  resetPlatformRole,
  updateDefaultTemplate,
  updatePlatformRole,
} from './roles';

const snapshot = (
  permissions: ReadonlyArray<{ action: string; scope: string }>,
): CurrentAccessDto => ({
  membershipId: 'mem',
  userId: 'owner@acme.test',
  accountId: 'acct-staff',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

const access = (
  permissions: ReadonlyArray<{ action: string; scope: string }> = [
    { action: 'permissions.update', scope: 'any' },
  ],
): AccessClientUseCases =>
  ({
    currentAccess: async () => ok(snapshot(permissions)),
  }) as unknown as AccessClientUseCases;

const rolesGateway = (over: Partial<RolesGateway> = {}): RolesGateway =>
  ({
    listRoles: async () => ok([]),
    createRole: async () => ok({ roleId: 'r-new' }),
    deleteRole: async () => ok(undefined),
    resetRole: async () => ok(undefined),
    updateRole: async () => ok(undefined),
    assignRoles: async () => ok(undefined),
    listTemplates: async () => ok([]),
    updateTemplate: async () => ok(undefined),
    resetTemplate: async () => ok(undefined),
    applyTemplateToAll: async () => ok({ updated: 0 }),
    ...over,
  }) as RolesGateway;

describe('dashboard role flows', () => {
  it('loadPlatformRoles returns the roles + canManage from permissions.update', async () => {
    const r = await loadPlatformRoles({
      access: access(),
      roles: rolesGateway({
        listRoles: async () =>
          ok([
            {
              id: 'r1',
              name: 'Support',
              accountId: null,
              permissions: [],
              templateKey: 'support',
              templateSynced: true,
            },
          ]),
      }),
    });
    expect(r.ok && r.value.canManage).toBe(true);
    expect(r.ok && r.value.roles).toHaveLength(1);
  });

  it('loadPlatformRoles reports canManage false without permissions.update', async () => {
    const r = await loadPlatformRoles({
      access: access([{ action: 'staff.read', scope: 'any' }]),
      roles: rolesGateway(),
    });
    expect(r.ok && r.value.canManage).toBe(false);
  });

  it('createPlatformRole forwards as a platform role (accountId null)', async () => {
    const createRole = vi.fn(async () => ok({ roleId: 'r-9' }));
    await createPlatformRole(
      { roles: rolesGateway({ createRole }) },
      {
        name: 'Auditor',
        permissions: [{ action: 'audit.read', scope: 'any' }],
      },
    );
    expect(createRole).toHaveBeenCalledWith({
      name: 'Auditor',
      accountId: null,
      permissions: [{ action: 'audit.read', scope: 'any' }],
    });
  });

  it('deletePlatformRole forwards the role id', async () => {
    const deleteRole = vi.fn(async () => ok(undefined));
    await deletePlatformRole(
      { roles: rolesGateway({ deleteRole }) },
      {
        roleId: 'r-9',
      },
    );
    expect(deleteRole).toHaveBeenCalledWith('r-9');
  });

  it('assignMemberRoles forwards the membership + role ids', async () => {
    const assignRoles = vi.fn(async () => ok(undefined));
    await assignMemberRoles(
      { roles: rolesGateway({ assignRoles }) },
      { membershipId: 'm-1', roleIds: ['r1', 'r2'] },
    );
    expect(assignRoles).toHaveBeenCalledWith({
      membershipId: 'm-1',
      roleIds: ['r1', 'r2'],
    });
  });

  it('resetPlatformRole forwards the role id', async () => {
    const resetRole = vi.fn(async () => ok(undefined));
    await resetPlatformRole(
      { roles: rolesGateway({ resetRole }) },
      {
        roleId: 'r-7',
      },
    );
    expect(resetRole).toHaveBeenCalledWith('r-7');
  });

  it('updatePlatformRole forwards roleId + name + permissions', async () => {
    const updateRole = vi.fn(async () => ok(undefined));
    const permissions = [{ action: 'audit.read', scope: 'any' }];
    await updatePlatformRole(
      { roles: rolesGateway({ updateRole }) },
      { roleId: 'r-9', name: 'Auditor', permissions },
    );
    expect(updateRole).toHaveBeenCalledWith({
      roleId: 'r-9',
      name: 'Auditor',
      permissions,
    });
  });

  it('loadDefaultTemplates returns the templates + canManage', async () => {
    const r = await loadDefaultTemplates({
      access: access(),
      roles: rolesGateway({
        listTemplates: async () =>
          ok([
            {
              key: 'support',
              scope: 'platform',
              name: 'Support',
              permissions: [],
            },
          ]),
      }),
    });
    expect(r.ok && r.value.canManage).toBe(true);
    expect(r.ok && r.value.templates).toHaveLength(1);
  });

  it('loadDefaultTemplates reports canManage false without permissions.update', async () => {
    const r = await loadDefaultTemplates({
      access: access([{ action: 'staff.read', scope: 'any' }]),
      roles: rolesGateway(),
    });
    expect(r.ok && r.value.canManage).toBe(false);
  });

  it('updateDefaultTemplate forwards key + name + permissions', async () => {
    const updateTemplate = vi.fn(async () => ok(undefined));
    await updateDefaultTemplate(
      { roles: rolesGateway({ updateTemplate }) },
      {
        key: 'support',
        name: 'Support (edited)',
        permissions: [{ action: 'staff.read', scope: 'any' }],
      },
    );
    expect(updateTemplate).toHaveBeenCalledWith({
      key: 'support',
      name: 'Support (edited)',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
  });

  it('resetDefaultTemplate forwards the template key', async () => {
    const resetTemplate = vi.fn(async () => ok(undefined));
    await resetDefaultTemplate(
      { roles: rolesGateway({ resetTemplate }) },
      { key: 'admin' },
    );
    expect(resetTemplate).toHaveBeenCalledWith('admin');
  });

  it('applyTemplateToAll forwards the template key', async () => {
    const applyTpl = vi.fn(async () => ok({ updated: 3 }));
    await applyTemplateToAll(
      { roles: rolesGateway({ applyTemplateToAll: applyTpl }) },
      { key: 'member' },
    );
    expect(applyTpl).toHaveBeenCalledWith('member');
  });
});
