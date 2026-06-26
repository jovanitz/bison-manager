import { type Result, err, ok } from '@acme/shared';
import type {
  RolesGateway,
  RoleSummaryDto,
} from '../../access-client/roles-ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import { holdsAction } from '../capabilities';
import type { OrgAdminError } from './org-admin';

/**
 * The client-side "manage your org's roles" controller (ADR-0011/0014). Headless
 * orchestration over the SAME `RolesGateway` the staff dashboard uses, but
 * scoped to the actor's OWN account: it lists/creates/resets the org's roles
 * (the server re-authorizes each and enforces the customer-delegable subset).
 * No React, no transport — a store and a future MCP server drive these functions.
 */
export type OrgRolesDeps = {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
};

/** What the UI renders. `hidden` collapses the whole section. */
export type OrgRolesViewModel =
  | { readonly hidden: true }
  | {
      readonly hidden: false;
      readonly accountId: string;
      readonly roles: ReadonlyArray<RoleSummaryDto>;
    };

/** Query: the org's roles, gated on `permissions.update` (who-can-do-what). */
export const loadOrgRoles = async (
  deps: OrgRolesDeps,
): Promise<Result<OrgRolesViewModel, OrgAdminError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const access = snapshot.value;
  if (!holdsAction(access, 'permissions.update')) return ok({ hidden: true });
  const listed = await deps.roles.listRoles(access.accountId);
  if (!listed.ok) return err(listed.error);
  return ok({
    hidden: false,
    accountId: access.accountId,
    roles: listed.value,
  });
};

/** Command: create a role in the actor's OWN org (account-scoped). */
export const createOrgRole = async (
  deps: OrgRolesDeps,
  input: {
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  },
): Promise<Result<{ readonly roleId: string }, OrgAdminError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  return deps.roles.createRole({
    name: input.name,
    accountId: snapshot.value.accountId,
    permissions: input.permissions,
  });
};

/** Command: delete a custom org role (the server refuses defaults / in-use). */
export const deleteOrgRole = (
  deps: OrgRolesDeps,
  input: { readonly roleId: string },
): Promise<Result<void, OrgAdminError>> => deps.roles.deleteRole(input.roleId);

/** Command: reset a default org role to its (staff) template — the recovery net. */
export const resetOrgRole = (
  deps: OrgRolesDeps,
  input: { readonly roleId: string },
): Promise<Result<void, OrgAdminError>> => deps.roles.resetRole(input.roleId);

/**
 * Command: edit an org role's name + permissions in place (ADR-0011). A live
 * reference — every member holding it updates on its next request. The server
 * keeps it scoped/delegable and refuses stripping admin from an assigned role.
 */
export const updateOrgRole = (
  deps: Pick<OrgRolesDeps, 'roles'>,
  input: {
    readonly roleId: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  },
): Promise<Result<void, OrgAdminError>> => deps.roles.updateRole(input);

/** Command: replace a member's whole role assignment (ADR-0011, roles-only). */
export const assignOrgMemberRoles = (
  deps: Pick<OrgRolesDeps, 'roles'>,
  input: {
    readonly membershipId: string;
    readonly roleIds: ReadonlyArray<string>;
  },
): Promise<Result<void, OrgAdminError>> => deps.roles.assignRoles(input);
