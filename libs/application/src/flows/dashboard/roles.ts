import { type Result, err, ok } from '@acme/shared';
import type { RolesGateway, RoleSummaryDto } from '../../access-client/ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import { holdsAction } from '../capabilities';
import type { DashboardError } from './queries';

/** The roles table the staff dashboard renders + whether the actor may edit. */
export type RolesViewModel = {
  readonly roles: ReadonlyArray<RoleSummaryDto>;
  readonly canManage: boolean;
};

/** Load the platform roles (accountId null) + the manage capability. */
export const loadPlatformRoles = async (deps: {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
}): Promise<Result<RolesViewModel, DashboardError>> => {
  const [listed, snapshot] = await Promise.all([
    deps.roles.listRoles(null),
    deps.access.currentAccess(),
  ]);
  if (!listed.ok) return err(listed.error);
  return ok({
    roles: listed.value,
    canManage: snapshot.ok && holdsAction(snapshot.value, 'permissions.update'),
  });
};

/** Command: create a platform-wide role (accountId null). */
export const createPlatformRole = (
  deps: { readonly roles: RolesGateway },
  input: {
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  },
): Promise<Result<{ readonly roleId: string }, DashboardError>> =>
  deps.roles.createRole({
    name: input.name,
    accountId: null,
    permissions: input.permissions,
  });

/** Command: delete a role (the server refuses while it is still assigned). */
export const deletePlatformRole = (
  deps: { readonly roles: RolesGateway },
  input: { readonly roleId: string },
): Promise<Result<void, DashboardError>> => deps.roles.deleteRole(input.roleId);

/** Command: replace a membership's whole role assignment (ADR-0011). */
export const assignMemberRoles = (
  deps: { readonly roles: RolesGateway },
  input: {
    readonly membershipId: string;
    readonly roleIds: ReadonlyArray<string>;
  },
): Promise<Result<void, DashboardError>> => deps.roles.assignRoles(input);
