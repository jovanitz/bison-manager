import { z } from 'zod';
import type { AccessUseCases, AuditTrailUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

export const createAccessProcedures = (useCases: {
  readonly access: AccessUseCases;
  readonly auditTrail: AuditTrailUseCases;
}): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'access.current',
    summary:
      "The caller's current access snapshot: permissions, active grants, session.",
    action: null, // any authenticated actor may ask about itself
    input: z.object({}).strict(),
    handler: ({ actor }) =>
      useCases.access.getCurrentAccess({ sessionId: actor.session.id }),
  }),
  defineApiProcedure({
    name: 'audit.list',
    summary: 'Read the append-only security audit trail.',
    action: 'audit.read',
    input: z
      .object({
        accountId: z.string().min(1).optional(),
        limit: z.number().int().positive().max(200).optional(),
      })
      .strict(),
    handler: ({ actor, input }) =>
      useCases.auditTrail.listAuditEvents({
        actor,
        filter: {
          ...(input.accountId === undefined
            ? {}
            : { accountId: input.accountId }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
        },
      }),
  }),
];
