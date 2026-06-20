import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import { createRole as createRoleEntity, makeRoleName } from '@acme/domain';
import type { AccessActor, Role, RoleId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import type { AccessAdminRepository } from '../access-admin/ports';
import { makeAssignMemberRoles } from './assign';
import { makeInstallDefaults, makeResetRole } from './lifecycle/defaults';
import {
  ROLE_ACTION,
  guardRolePermissions,
  parseAccountId,
  type RawPermission,
} from './guards';
import type { RoleStore } from './ports';
import {
  roleInUse,
  roleIsDefault,
  roleNotFound,
  type RoleUseCaseError,
} from './errors';

export type AccessRolesDeps = {
  readonly roles: RoleStore;
  readonly admin: AccessAdminRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

export const makeCreateRole =
  (deps: AccessRolesDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly name: string;
    readonly accountId: string | null;
    readonly permissions: ReadonlyArray<RawPermission>;
  }): Promise<Result<{ readonly roleId: RoleId }, RoleUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const accountId = parseAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const permissions = guardRolePermissions(
      input.actor,
      accountId.value,
      input.permissions,
      now,
    );
    if (!permissions.ok) return err(permissions.error);
    const role = createRoleEntity({
      id: deps.ids.next() as RoleId,
      name: input.name,
      accountId: accountId.value,
      permissions: permissions.value,
    });
    if (!role.ok) return err(role.error);
    await deps.roles.create(role.value);
    return ok({ roleId: role.value.id });
  };

export const makeListRoles =
  (deps: AccessRolesDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string | null;
  }): Promise<Result<ReadonlyArray<Role>, RoleUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const accountId = parseAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: ROLE_ACTION,
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.roles.list(accountId.value));
  };

export const makeUpdateRole =
  (deps: AccessRolesDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly roleId: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<RawPermission>;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const role = await deps.roles.findById(input.roleId as RoleId);
    if (!role) return err(roleNotFound('No such role.'));
    const name = makeRoleName(input.name);
    if (!name.ok) return err(name.error);
    const permissions = guardRolePermissions(
      input.actor,
      role.accountId,
      input.permissions,
      now,
    );
    if (!permissions.ok) return err(permissions.error);
    const updated = await deps.roles.update(role.id, {
      name: name.value,
      permissions: permissions.value,
    });
    return updated ? ok(undefined) : err(roleNotFound('No such role.'));
  };

export const makeDeleteRole =
  (deps: AccessRolesDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly roleId: string;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const role = await deps.roles.findById(input.roleId as RoleId);
    if (!role) return err(roleNotFound('No such role.'));
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: ROLE_ACTION,
      resource: { accountId: role.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);
    if (role.templateKey !== null) {
      return err(
        roleIsDefault('A default role cannot be deleted; reset it instead.'),
      );
    }
    const assignments = await deps.roles.countAssignments(role.id);
    if (assignments > 0) {
      return err(
        roleInUse(`Role is still assigned to ${assignments} member(s).`),
      );
    }
    await deps.roles.remove(role.id);
    return ok(undefined);
  };

export type AccessRolesUseCases = {
  readonly createRole: ReturnType<typeof makeCreateRole>;
  readonly listRoles: ReturnType<typeof makeListRoles>;
  readonly updateRole: ReturnType<typeof makeUpdateRole>;
  readonly deleteRole: ReturnType<typeof makeDeleteRole>;
  readonly assignMemberRoles: ReturnType<typeof makeAssignMemberRoles>;
  readonly resetRole: ReturnType<typeof makeResetRole>;
  readonly installDefaults: ReturnType<typeof makeInstallDefaults>;
};

export const makeAccessRolesUseCases = (
  deps: AccessRolesDeps,
): AccessRolesUseCases => ({
  createRole: makeCreateRole(deps),
  listRoles: makeListRoles(deps),
  updateRole: makeUpdateRole(deps),
  deleteRole: makeDeleteRole(deps),
  assignMemberRoles: makeAssignMemberRoles(deps),
  resetRole: makeResetRole(deps),
  installDefaults: makeInstallDefaults(deps),
});
