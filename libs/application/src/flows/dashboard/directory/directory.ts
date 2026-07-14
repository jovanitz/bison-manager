import { type Result, err, ok } from '@acme/shared';
import type { OrphanIdentitySummary } from '../../../access-directory/ports';
import type { PendingInvitationSummary } from '../../../access-invitations/ports';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import type { DirectoryUseCases } from '../../../access-client/gateways/directory-use-cases';
import type { InvitationsUseCases } from '../../../access-client/gateways/invitations-use-cases';
import { holdsAction } from '../../capabilities';
import type { DashboardError } from '../queries';

/**
 * The billing coverage a customer row shows — a FLAT read of the ledger's
 * derived coverage (ADR-0018), so the UI never touches domain types. Backed by
 * `getCoverage` behind an adapter (deferred). `null` = the account has no
 * subscription/billing, or its coverage is momentarily unavailable (fail-soft:
 * one customer's billing hiccup never blanks the whole directory).
 */
export type CoverageDto = {
  readonly phase: 'trialing' | 'active' | 'grace' | 'suspended' | 'canceled';
  readonly dormant: boolean;
  readonly balanceMinor: number;
  readonly currency: string;
  readonly paidThroughAt: string | null;
};

export type CoverageReader = {
  readonly coverageFor: (accountId: string) => Promise<CoverageDto | null>;
};

export type DirectoryStaff = {
  readonly accountId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  /** The signed-in staff — surfaces self-moderation guards in the UI. */
  readonly isSelf: boolean;
};

export type DirectoryCustomer = {
  readonly accountId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly coverage: CoverageDto | null;
};

/** The enriched staff-directory read model — thin summaries joined with billing
 *  coverage + the actor's capability flags. The UI store maps this to its VM. */
export type DirectoryReadModel = {
  readonly staff: readonly DirectoryStaff[];
  readonly customers: readonly DirectoryCustomer[];
  readonly orphans: readonly OrphanIdentitySummary[];
  readonly pendingInvitations: readonly PendingInvitationSummary[];
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
};

export type LoadDirectoryDeps = {
  readonly access: Pick<AccessClientUseCases, 'currentAccess'>;
  readonly directory: Pick<
    DirectoryUseCases,
    'listStaff' | 'listCustomers' | 'listOrphans'
  >;
  readonly invitations: Pick<InvitationsUseCases, 'listPending'>;
  readonly billing: CoverageReader;
};

export const loadDirectory = async (
  deps: LoadDirectoryDeps,
): Promise<Result<DirectoryReadModel, DashboardError>> => {
  const [staff, customers, orphans, pending, snapshot] = await Promise.all([
    deps.directory.listStaff(),
    deps.directory.listCustomers(),
    deps.directory.listOrphans(),
    deps.invitations.listPending(),
    deps.access.currentAccess(),
  ]);
  if (!staff.ok) return err(staff.error);
  if (!customers.ok) return err(customers.error);
  if (!orphans.ok) return err(orphans.error);
  if (!pending.ok) return err(pending.error);

  const selfAccountId = snapshot.ok ? snapshot.value.accountId : null;
  const enrichedCustomers = await Promise.all(
    customers.value.map(async (c) => ({
      accountId: c.accountId,
      displayName: c.displayName,
      email: c.email,
      coverage: await deps.billing.coverageFor(c.accountId),
    })),
  );
  return ok({
    staff: staff.value.map((s) => ({
      accountId: s.accountId,
      email: s.email,
      displayName: s.displayName,
      isSelf: s.accountId === selfAccountId,
    })),
    customers: enrichedCustomers,
    orphans: orphans.value,
    pendingInvitations: pending.value,
    canBlock: snapshot.ok && holdsAction(snapshot.value, 'access.block'),
    canAdminAccounts:
      snapshot.ok && holdsAction(snapshot.value, 'account.disable'),
  });
};
