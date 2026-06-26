import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { RolesGateway } from '../../access-client/roles-ports';
import {
  assignOrgMemberRoles,
  createOrgRole,
  deleteOrgRole,
  loadOrgRoles,
  resetOrgRole,
  updateOrgRole,
} from './roles';

const snapshot = (
  permissions: ReadonlyArray<{ action: string; scope: string }>,
): CurrentAccessDto => ({
  membershipId: 'mem',
  userId: 'admin@org.test',
  accountId: 'acct-org',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

const access = (
  permissions: ReadonlyArray<{ action: string; scope: string }> = [
    { action: 'permissions.update', scope: 'own' },
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

describe('client org-roles flows', () => {
  it('hides the section without permissions.update', async () => {
    const r = await loadOrgRoles({
      access: access([{ action: 'customer.read', scope: 'own' }]),
      roles: rolesGateway(),
    });
    expect(r.ok && r.value.hidden).toBe(true);
  });

  it('loads the OWN account roles when permitted', async () => {
    const listRoles = vi.fn(async () =>
      ok([
        {
          id: 'r1',
          name: 'Front desk',
          accountId: 'acct-org',
          permissions: [],
          templateKey: null,
          templateSynced: true,
        },
      ]),
    );
    const r = await loadOrgRoles({
      access: access(),
      roles: rolesGateway({ listRoles }),
    });
    expect(listRoles).toHaveBeenCalledWith('acct-org');
    expect(r.ok && !r.value.hidden && r.value.roles).toHaveLength(1);
  });

  it('createOrgRole scopes the role to the actor’s own account', async () => {
    const createRole = vi.fn(async () => ok({ roleId: 'r-9' }));
    await createOrgRole(
      { access: access(), roles: rolesGateway({ createRole }) },
      {
        name: 'Front desk',
        permissions: [{ action: 'members.read', scope: 'own' }],
      },
    );
    expect(createRole).toHaveBeenCalledWith({
      name: 'Front desk',
      accountId: 'acct-org',
      permissions: [{ action: 'members.read', scope: 'own' }],
    });
  });

  it('assignOrgMemberRoles forwards the membership + role ids', async () => {
    const assignRoles = vi.fn(async () => ok(undefined));
    await assignOrgMemberRoles(
      { roles: rolesGateway({ assignRoles }) },
      { membershipId: 'm-1', roleIds: ['r1', 'r2'] },
    );
    expect(assignRoles).toHaveBeenCalledWith({
      membershipId: 'm-1',
      roleIds: ['r1', 'r2'],
    });
  });

  it('resetOrgRole and deleteOrgRole forward the role id', async () => {
    const resetRole = vi.fn(async () => ok(undefined));
    const deleteRole = vi.fn(async () => ok(undefined));
    await resetOrgRole(
      { access: access(), roles: rolesGateway({ resetRole }) },
      { roleId: 'r-7' },
    );
    await deleteOrgRole(
      { access: access(), roles: rolesGateway({ deleteRole }) },
      { roleId: 'r-8' },
    );
    expect(resetRole).toHaveBeenCalledWith('r-7');
    expect(deleteRole).toHaveBeenCalledWith('r-8');
  });

  it('updateOrgRole forwards roleId + name + permissions', async () => {
    const updateRole = vi.fn(async () => ok(undefined));
    const permissions = [{ action: 'members.read', scope: 'own' }];
    await updateOrgRole(
      { roles: rolesGateway({ updateRole }) },
      { roleId: 'r-9', name: 'Helper', permissions },
    );
    expect(updateRole).toHaveBeenCalledWith({
      roleId: 'r-9',
      name: 'Helper',
      permissions,
    });
  });
});
