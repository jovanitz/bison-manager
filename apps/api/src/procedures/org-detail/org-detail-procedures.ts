import { z } from 'zod';
import type { AccessOrgDetailUseCases } from '@acme/application';
import { defineApiProcedure } from '../../rpc/procedure';
import type { ApiProcedure } from '../../rpc/procedure';

const accountInput = z.object({ accountId: z.string() }).strict();

/**
 * The customer (org) detail drill-down: administrative reads of one org, NOT
 * impersonation. `org.summary` reuses `customer.search` (staff-visible metadata,
 * no grant); `org.members` uses `members.read` (staff any / org admin own). The
 * declared `action` is metadata; each use case authorizes with the concrete
 * resource in hand.
 */
export const createOrgDetailProcedures = (
  orgDetail: AccessOrgDetailUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'org.summary',
    summary:
      "Read a customer org's admin metadata (name, status, created). Same " +
      'permission as the customer directory (customer.search) — no grant, ' +
      'administrative, never impersonation.',
    action: 'customer.search',
    input: accountInput,
    handler: ({ actor, input }) =>
      orgDetail.getOrgSummary({ actor, accountId: input.accountId }),
  }),
  defineApiProcedure({
    name: 'org.members',
    summary:
      "List a customer org's member roster (members.read). An administrative " +
      'read of who belongs to the org — distinct from impersonation.',
    action: 'members.read',
    input: accountInput,
    handler: ({ actor, input }) =>
      orgDetail.listOrgMembers({ actor, accountId: input.accountId }),
  }),
];
