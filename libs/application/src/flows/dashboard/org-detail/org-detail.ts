import { type Result, err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../../access/dto';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import type {
  OrgDetailGateway,
  OrgMemberDto,
} from '../../../access-client/ports';
import type {
  BillingGateway,
  BillingSummaryDto,
  LedgerViewDto,
} from '../../../access-client/billing-ports';
import { holdsAction } from '../../capabilities';
import type { DashboardError } from '../queries';

type OrgBillingGateway = Pick<BillingGateway, 'getSummary' | 'listLedger'>;

/** The customer (org) detail screen: admin summary + roster + capabilities. */
export type OrgDetailViewModel = {
  readonly accountId: string;
  readonly name: string;
  readonly email: string | null;
  readonly status: string;
  readonly createdAt: string;
  /** Derived from the roster (the member holding the owner role). */
  readonly owner: {
    readonly name: string;
    readonly email: string | null;
  } | null;
  /** Actor holds `members.read` → the roster is shown (administrative, no grant). */
  readonly canViewMembers: boolean;
  /** Actor can moderate members (block / disable) — `members.block`. */
  readonly canManageMembers: boolean;
  /** Actor can start impersonation ("view as customer") — a SEPARATE action. */
  readonly canImpersonate: boolean;
  readonly members: ReadonlyArray<OrgMemberDto>;
  /** Present when the actor holds `billing.read` AND the summary read worked;
   * a failed/gated summary leaves it undefined without sinking the page. */
  readonly subscription?: BillingSummaryDto;
  /** The org's billing ledger (charges + payments); same best-effort gate as the
   * subscription. The card's balance is the ledger's final running total, so the
   * two views (ADR-0018) cannot disagree. */
  readonly ledger?: LedgerViewDto;
  /** Actor may pull the manual billing levers (`plans.manage`). */
  readonly canManageBilling: boolean;
};

/** Best-effort billing enrichment (gated on `billing.read`): a failed summary /
 * ledger read returns undefined instead of sinking the whole org-detail load. */
const fetchBilling = async (
  deps: { readonly billing: OrgBillingGateway },
  access: CurrentAccessDto,
  accountId: string,
): Promise<{
  readonly subscription?: BillingSummaryDto;
  readonly ledger?: LedgerViewDto;
}> => {
  if (!holdsAction(access, 'billing.read')) return {};
  const [summary, ledger] = await Promise.all([
    deps.billing.getSummary(accountId),
    deps.billing.listLedger(accountId),
  ]);
  return {
    ...(summary.ok ? { subscription: summary.value } : {}),
    ...(ledger.ok ? { ledger: ledger.value } : {}),
  };
};

/**
 * Loads a customer org's detail for the directory drill-down. The roster is an
 * administrative read gated by `members.read` (staff any / org admin own) — NOT
 * impersonation. "View as customer" (`impersonation.start`) is offered
 * separately. Owner is derived from the roster; when the actor lacks
 * `members.read` the roster is empty and the screen shows the gated state.
 * When the actor holds `billing.read` the org's subscription summary is
 * attached (see `fetchSubscription`); `plans.manage` gates the levers.
 */
export const loadOrgDetail = async (
  deps: {
    readonly access: AccessClientUseCases;
    readonly orgs: OrgDetailGateway;
    readonly billing: OrgBillingGateway;
  },
  input: { readonly accountId: string },
): Promise<Result<OrgDetailViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const access = snapshot.value;

  const summary = await deps.orgs.getSummary(input.accountId);
  if (!summary.ok) return err(summary.error);

  const canViewMembers = holdsAction(access, 'members.read');
  const roster = canViewMembers
    ? await deps.orgs.listMembers(input.accountId)
    : ok([] as ReadonlyArray<OrgMemberDto>);
  if (!roster.ok) return err(roster.error);

  const billing = await fetchBilling(deps, access, input.accountId);
  const ownerEntry = roster.value.find((m) => m.isAccountOwner);
  return ok({
    accountId: summary.value.accountId,
    name: summary.value.name,
    email: summary.value.email,
    status: summary.value.status,
    createdAt: summary.value.createdAt,
    owner: ownerEntry
      ? {
          name: ownerEntry.displayName ?? ownerEntry.email ?? ownerEntry.userId,
          email: ownerEntry.email,
        }
      : null,
    canViewMembers,
    canManageMembers: holdsAction(access, 'members.block'),
    canImpersonate: holdsAction(access, 'impersonation.start'),
    members: roster.value,
    ...billing,
    canManageBilling: holdsAction(access, 'plans.manage'),
  });
};
