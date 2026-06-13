import { z } from 'zod';
import type { AccessAdminUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

const accountDisable = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'account.disable',
    summary:
      'Disable an account; every session on it is denied from the next request.',
    action: 'account.disable',
    input: z
      .object({
        accountId: z.string().min(1),
        reason: z.string().min(1).max(500).optional(),
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessAdmin.disableAccount({
        actor,
        accountId: input.accountId,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      }),
  });

const accountEnable = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'account.enable',
    summary: 'Re-enable a disabled account (old sessions stay dead).',
    action: 'account.enable',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.enableAccount({ actor, accountId: input.accountId }),
  });

const accountPromote = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'account.promote',
    summary:
      'Promote a customer account to staff: strict session policy and out ' +
      'of the customer directory (never impersonable again).',
    action: 'account.promote',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.promoteAccountToStaff({ actor, accountId: input.accountId }),
  });

const permissionsUpdate = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'permissions.update',
    summary: "Replace a membership's permission list (the source of truth).",
    action: 'permissions.update',
    input: z
      .object({
        membershipId: z.string().min(1),
        permissions: z
          .array(
            z
              .object({
                action: z.string().min(1),
                scope: z.string().min(1),
              })
              .strict(),
          )
          .max(50),
      })
      .strict(),
    handler: ({ actor, input }) =>
      accessAdmin.updateUserPermissions({
        actor,
        membershipId: input.membershipId,
        permissions: input.permissions,
      }),
  });

const sessionsRevoke = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'sessions.revoke',
    summary: 'Revoke a session; it stops authorizing immediately.',
    action: 'sessions.revoke',
    input: z.object({ sessionId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.revokeSession({ actor, sessionId: input.sessionId }),
  });

const sessionsRevokeAll = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'sessions.revoke-all',
    summary:
      "Log a membership out everywhere: revokes all of that membership's " +
      'active sessions (audited one by one).',
    action: 'sessions.revoke',
    input: z.object({ membershipId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.revokeAllSessions({
        actor,
        membershipId: input.membershipId,
      }),
  });

const sessionsList = (accessAdmin: AccessAdminUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'sessions.list',
    summary:
      "A membership's sessions with their captured context (device, IPs, " +
      'activity) — the "active sessions" view.',
    action: 'sessions.read',
    input: z.object({ membershipId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.listSessions({ actor, membershipId: input.membershipId }),
  });

export const createAdminProcedures = (
  accessAdmin: AccessAdminUseCases,
): ReadonlyArray<ApiProcedure> => [
  accountDisable(accessAdmin),
  accountEnable(accessAdmin),
  accountPromote(accessAdmin),
  permissionsUpdate(accessAdmin),
  sessionsRevoke(accessAdmin),
  sessionsRevokeAll(accessAdmin),
  sessionsList(accessAdmin),
];
