import { z } from 'zod';
import type { AccessRolesUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

const permissionsSchema = z
  .array(
    z.object({ action: z.string().min(1), scope: z.string().min(1) }).strict(),
  )
  .max(50);

/** Replace a membership's whole role set (ADR-0011, roles-only assignment). */
const rolesAssign = (accessRoles: AccessRolesUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'roles.assign',
    summary:
      "Replace a membership's role assignment with the given set (ADR-0011, " +
      'roles-only). Each role must exist and be reachable by the account.',
    action: 'permissions.update',
    input: z
      .object({
        membershipId: z.string().min(1),
        roleIds: z.array(z.string().min(1)).max(50),
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessRoles.assignMemberRoles({
        actor,
        membershipId: input.membershipId,
        roleIds: input.roleIds,
      }),
  });

/** Reset a default role to its factory template (ADR-0012) — the safety net. */
const rolesReset = (accessRoles: AccessRolesUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'roles.reset',
    summary:
      'Reset a default role to its factory template (name + permissions, same ' +
      'id, assignments kept). Custom roles have no template and are refused.',
    action: 'permissions.update',
    input: z.object({ roleId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessRoles.resetRole({ actor, roleId: input.roleId }),
  });

/**
 * Dynamic role management (ADR-0011): named permission bundles, platform-wide
 * (`accountId: null`) or scoped to one customer org. Gated by the same action
 * as editing permissions — managing who-can-do-what — so root/owner reach it by
 * bypass. Assigning a role to a membership is a separate procedure.
 */
export const createRolesProcedures = (
  accessRoles: AccessRolesUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'roles.create',
    summary:
      'Create a permission bundle: platform-wide (accountId null) or scoped ' +
      'to one customer org. Account-scoped roles may not hold any-scoped power.',
    action: 'permissions.update',
    input: z
      .object({
        name: z.string().min(1).max(60),
        accountId: z.string().min(1).nullable(),
        permissions: permissionsSchema,
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessRoles.createRole({
        actor,
        name: input.name,
        accountId: input.accountId,
        permissions: input.permissions,
      }),
  }),
  defineApiProcedure({
    name: 'roles.list',
    summary:
      'List the roles available to an account: the platform-wide roles plus ' +
      "that account's own (accountId null lists platform roles only).",
    action: 'permissions.update',
    input: z.object({ accountId: z.string().min(1).nullable() }).strict(),
    handler: ({ actor, input }) =>
      accessRoles.listRoles({ actor, accountId: input.accountId }),
  }),
  defineApiProcedure({
    name: 'roles.update',
    summary:
      "Rotate a role's name and permission set (live reference: every " +
      'membership holding it sees the change on its next request).',
    action: 'permissions.update',
    input: z
      .object({
        roleId: z.string().min(1),
        name: z.string().min(1).max(60),
        permissions: permissionsSchema,
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessRoles.updateRole({
        actor,
        roleId: input.roleId,
        name: input.name,
        permissions: input.permissions,
      }),
  }),
  defineApiProcedure({
    name: 'roles.delete',
    summary:
      'Delete a custom role (refused while in use). A default role is refused ' +
      'too — reset it instead (ADR-0012), so authority never vanishes silently.',
    action: 'permissions.update',
    input: z.object({ roleId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessRoles.deleteRole({ actor, roleId: input.roleId }),
  }),
  rolesAssign(accessRoles),
  rolesReset(accessRoles),
];

/**
 * Staff-editable default-role templates (ADR-0013/0014): the curated catalogue
 * org instances are seeded from and reset to. Platform-staff only — the use
 * cases authorize `permissions.update` on the platform scope. Editing here does
 * not touch live roles; instances pick up an edit on their next reset.
 */
export const createTemplatesProcedures = (
  accessRoles: AccessRolesUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'templates.list',
    summary:
      'List the default-role templates: the code catalogue with staff edits ' +
      'applied over it (the recovery floor is always the code definition).',
    action: 'permissions.update',
    input: z.object({}).strict(),
    handler: ({ actor }) => accessRoles.listTemplates({ actor }),
  }),
  defineApiProcedure({
    name: 'templates.update',
    summary:
      "Edit a default template's name and permissions (ADR-0013). Coherence " +
      "is checked against the template's own scope; the key must exist.",
    action: 'permissions.update',
    input: z
      .object({
        key: z.string().min(1),
        name: z.string().min(1).max(60),
        permissions: permissionsSchema,
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessRoles.updateTemplate({
        actor,
        key: input.key,
        name: input.name,
        permissions: input.permissions,
      }),
  }),
  defineApiProcedure({
    name: 'templates.reset',
    summary:
      'Reset a default template to its code definition — the recovery floor ' +
      '(ADR-0013). Discards staff edits for that template key.',
    action: 'permissions.update',
    input: z.object({ key: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessRoles.resetTemplate({ actor, key: input.key }),
  }),
  defineApiProcedure({
    name: 'templates.apply-all',
    summary:
      'Force every live instance of a template — synced or forked — back to ' +
      'the template (ADR-0014). Overrides org-local edits; returns the count.',
    action: 'permissions.update',
    input: z.object({ key: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessRoles.applyTemplateToAll({ actor, key: input.key }),
  }),
];
