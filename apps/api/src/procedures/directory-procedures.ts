import { z } from 'zod';
import type { AccessDirectoryUseCases } from '@acme/application';
import { defineApiProcedure } from '../rpc/procedure';
import type { ApiProcedure } from '../rpc/procedure';

/**
 * The platform staff directory — the admin dashboard's "staff" table. The
 * customer half of that view is served by `customer.search` (impersonation
 * procedures); this is its staff-only counterpart, gated by `staff.read`.
 */
export const createDirectoryProcedures = (
  accessDirectory: AccessDirectoryUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'staff.list',
    summary:
      'List every staff (platform-internal) account — the staff directory ' +
      'the admin dashboard renders. Staff-only; never customer-visible.',
    action: 'staff.read',
    input: z.object({}).strict(),
    handler: ({ actor }) => accessDirectory.listStaff({ actor }),
  }),
  defineApiProcedure({
    name: 'customers.list',
    summary:
      'List every customer account — the customer directory the admin ' +
      'dashboard renders. Same permission as customer.search, no term needed.',
    action: 'customer.search',
    input: z.object({}).strict(),
    handler: ({ actor }) => accessDirectory.listCustomers({ actor }),
  }),
];
