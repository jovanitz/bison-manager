import { z } from 'zod';
import type { ImpersonationUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

export const createImpersonationProcedures = (
  impersonation: ImpersonationUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'customer.search',
    summary: 'Find customer accounts by name or email (support workflow).',
    action: 'customer.search',
    input: z.object({ query: z.string().min(1).max(200) }).strict(),
    handler: ({ actor, input }) =>
      impersonation.searchCustomers({ actor, query: input.query }),
  }),
  defineApiProcedure({
    name: 'customer.read',
    summary:
      'Read one customer account. Customers read their own; support needs an active impersonation grant on that exact account.',
    action: 'customer.read',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      impersonation.readCustomerAsSupport({
        actor,
        accountId: input.accountId,
      }),
  }),
  defineApiProcedure({
    name: 'impersonation.start',
    summary:
      'Open a view-only, expiring, reasoned window into one customer account. The actor stays the support agent.',
    action: 'impersonation.start',
    input: z
      .object({
        targetAccountId: z.string().min(1),
        reason: z.string().min(1).max(500),
        durationMinutes: z.number().int().positive().max(60).optional(),
      })
      .strict(),
    handler: ({ actor, input }) =>
      impersonation.startImpersonation({
        actor,
        targetAccountId: input.targetAccountId,
        reason: input.reason,
        ...(input.durationMinutes === undefined
          ? {}
          : { durationMinutes: input.durationMinutes }),
      }),
  }),
  defineApiProcedure({
    name: 'impersonation.end',
    summary: 'End an impersonation grant early (only its holder may).',
    action: 'impersonation.end',
    input: z.object({ grantId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      impersonation.endImpersonation({ actor, grantId: input.grantId }),
  }),
];
