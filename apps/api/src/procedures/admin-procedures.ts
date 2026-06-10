import { z } from 'zod';
import type { AccessAdminUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

export const createAdminProcedures = (
  accessAdmin: AccessAdminUseCases,
): ReadonlyArray<ApiProcedure> => [
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
  }),
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
  }),
  defineApiProcedure({
    name: 'sessions.revoke',
    summary: 'Revoke a session; it stops authorizing immediately.',
    action: 'sessions.revoke',
    input: z.object({ sessionId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      accessAdmin.revokeSession({ actor, sessionId: input.sessionId }),
  }),
];
