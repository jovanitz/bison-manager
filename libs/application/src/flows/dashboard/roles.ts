import { type Result, err, ok } from '@acme/shared';
import type {
  RolesGateway,
  RoleSummaryDto,
  RoleTemplateDto,
} from '../../access-client/roles-ports';
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

/** Command: reset a default role to its factory template (ADR-0012). */
export const resetPlatformRole = (
  deps: { readonly roles: RolesGateway },
  input: { readonly roleId: string },
): Promise<Result<void, DashboardError>> => deps.roles.resetRole(input.roleId);

/** Command: edit a role's name + permissions in place (ADR-0011, live to holders). */
export const updatePlatformRole = (
  deps: { readonly roles: RolesGateway },
  input: {
    readonly roleId: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  },
): Promise<Result<void, DashboardError>> => deps.roles.updateRole(input);

/** Command: replace a membership's whole role assignment (ADR-0011). */
export const assignMemberRoles = (
  deps: { readonly roles: RolesGateway },
  input: {
    readonly membershipId: string;
    readonly roleIds: ReadonlyArray<string>;
  },
): Promise<Result<void, DashboardError>> => deps.roles.assignRoles(input);

/** The default-role templates table the staff dashboard renders + edit gate. */
export type TemplatesViewModel = {
  readonly templates: ReadonlyArray<RoleTemplateDto>;
  readonly canManage: boolean;
};

/** Load the editable default-role templates + the manage capability (ADR-0013). */
export const loadDefaultTemplates = async (deps: {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
}): Promise<Result<TemplatesViewModel, DashboardError>> => {
  const [listed, snapshot] = await Promise.all([
    deps.roles.listTemplates(),
    deps.access.currentAccess(),
  ]);
  if (!listed.ok) return err(listed.error);
  return ok({
    templates: listed.value,
    canManage: snapshot.ok && holdsAction(snapshot.value, 'permissions.update'),
  });
};

/** Command: edit a default template's name + permissions (ADR-0013). */
export const updateDefaultTemplate = (
  deps: { readonly roles: RolesGateway },
  input: {
    readonly key: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  },
): Promise<Result<void, DashboardError>> => deps.roles.updateTemplate(input);

/** Command: reset a default template to its code definition (ADR-0013). */
export const resetDefaultTemplate = (
  deps: { readonly roles: RolesGateway },
  input: { readonly key: string },
): Promise<Result<void, DashboardError>> => deps.roles.resetTemplate(input.key);

/** Command: force every instance of a template back to it (ADR-0014). */
export const applyTemplateToAll = (
  deps: { readonly roles: RolesGateway },
  input: { readonly key: string },
): Promise<Result<{ readonly updated: number }, DashboardError>> =>
  deps.roles.applyTemplateToAll(input.key);
