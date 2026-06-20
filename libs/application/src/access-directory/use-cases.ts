import { type Clock, type Result, err, ok } from '@acme/shared';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import type { AccessUseCaseError } from '../access/errors';
import type {
  CustomerAccountSummary,
  CustomerDirectory,
} from '../impersonation/ports';
import type {
  OrphanIdentitySummary,
  StaffAccountSummary,
  StaffDirectory,
} from './ports';

export type AccessDirectoryDeps = {
  readonly staffDirectory: StaffDirectory;
  readonly customers: CustomerDirectory;
  readonly clock: Clock;
};

/**
 * The staff directory the platform-admin dashboard renders. A platform read,
 * gated by `staff.read` (an `any`-scoped, staff-only action) — never reachable
 * from inside a customer organization. The resource is account-less because the
 * query spans every staff account, not one.
 */
export const makeListStaff =
  (deps: AccessDirectoryDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<
    Result<ReadonlyArray<StaffAccountSummary>, AccessUseCaseError>
  > => {
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'staff.read',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.staffDirectory.listStaff());
  };

/**
 * The customer half of the dashboard directory. Reuses the customer directory
 * (an empty query lists every customer) but is its own LISTING capability,
 * distinct from support's `customer.search` UX which requires a search term —
 * same `customer.search` permission, no term required.
 */
export const makeListCustomers =
  (deps: AccessDirectoryDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<
    Result<ReadonlyArray<CustomerAccountSummary>, AccessUseCaseError>
  > => {
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'customer.search',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.customers.search(''));
  };

/**
 * Org-less ("zombie") identities — sign-ups that belong to no account. A
 * platform-cleanup read, gated by the same `staff.read` as the staff directory.
 * The list is empty under an in-memory store (no auth layer to be orphaned from).
 */
export const makeListOrphanIdentities =
  (deps: AccessDirectoryDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<
    Result<ReadonlyArray<OrphanIdentitySummary>, AccessUseCaseError>
  > => {
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'staff.read',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.staffDirectory.listOrphanIdentities());
  };

export type AccessDirectoryUseCases = {
  readonly listStaff: ReturnType<typeof makeListStaff>;
  readonly listCustomers: ReturnType<typeof makeListCustomers>;
  readonly listOrphanIdentities: ReturnType<typeof makeListOrphanIdentities>;
};

export const makeAccessDirectoryUseCases = (
  deps: AccessDirectoryDeps,
): AccessDirectoryUseCases => ({
  listStaff: makeListStaff(deps),
  listCustomers: makeListCustomers(deps),
  listOrphanIdentities: makeListOrphanIdentities(deps),
});
