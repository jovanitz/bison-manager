import type { Clock, IdGenerator } from '@acme/shared';
import {
  makeBillingLedgerUseCases,
  makeBillingPlansUseCases,
  makeBillingSubscriptionsUseCases,
  makeEntitlementGuards,
} from '@acme/application';
import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  BillingLedgerUseCases,
  BillingPlansUseCases,
  BillingSubscriptionsUseCases,
  CreateOrganizationDeps,
  EntitlementGuards,
} from '@acme/application';
import type { Charge, Payment } from '@acme/domain';
import {
  createInMemoryBillingStore,
  createInMemoryChargeStore,
  createInMemoryPaymentStore,
} from '@acme/infrastructure';
import type {
  BillingStoreState,
  InMemoryBillingStore,
} from '@acme/infrastructure';

/**
 * Delinquency grace window in days (ADR-0016 Decision 4/5): a `past_due` org
 * on a PRICED plan is held only once this window — anchored at when the price
 * was first set, never at expiry — has elapsed. It exists so a pricing launch
 * cannot mass-lock the backlog of unpriced-era expirees on day one.
 */
export const BILLING_GRACE_DAYS = 14;

export type BillingWiring = {
  readonly plans: BillingPlansUseCases;
  readonly subscriptions: BillingSubscriptionsUseCases;
  readonly guards: EntitlementGuards;
  /**
   * The billing-ledger use cases (ADR-0018) over ONE shared charge + payment
   * store: coverage/ledger reads AND the mutations (record-payment, void,
   * refund) that must see each other's writes. `getCoverage` is re-exposed for
   * the Directory rows that only need coverage.
   */
  readonly ledger: BillingLedgerUseCases;
  readonly getCoverage: BillingLedgerUseCases['getCoverage'];
  /**
   * The raw port surface, for the enforcement wiring the use-case bundles do
   * not cover: `plans.findDefaultPlan` + `subscriptions.hasTrialConsumedByUser`
   * feed `makeCreateOrganizationUseCases` (ADR-0016 Decision 4).
   */
  readonly store: InMemoryBillingStore;
};

/**
 * Assemble the billing context (ADR-0016): the in-memory billing store over
 * the PRE-BUILT shared state (created first by the composition root, so the
 * identity onboarding's atomic birth writes land in the same maps) — seeded
 * with the `DEFAULT_PLANS` code floor by `toBillingStoreState`, the
 * migration's `on conflict do nothing` analog — whose usage reader is
 * COMPOSED over the access store's member/ownership surface, then the
 * plan-catalog use cases, the staff levers + summary, and the entitlement
 * guards the rpc pipeline enforces `feature` with. The Postgres billing
 * adapters slot in here once they are wired (deliberately not exported yet).
 */
/** The billing birth deps of `makeCreateOrganizationUseCases` (ADR-0016 D4). */
export const toCreateOrgBilling = (
  wiring: BillingWiring,
): CreateOrganizationDeps['billing'] => ({
  guardOrgCreation: wiring.guards.guardOrgCreation,
  hasTrialConsumedByUser: wiring.store.subscriptions.hasTrialConsumedByUser,
  defaultPlan: wiring.store.plans.findDefaultPlan,
});

export const wireBilling = (deps: {
  readonly access: {
    readonly members: Pick<
      AccessMemberDirectory,
      'listMembers' | 'listMembershipsByUser'
    >;
    readonly admin: Pick<AccessAdminRepository, 'findMembership'>;
  };
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly state: BillingStoreState;
  /** Dev-stub only: pre-populate the ledger so the org-detail Ledger card has a
   *  real payment to void/refund. Absent in tests + Postgres. */
  readonly ledgerSeed?: {
    readonly charges: readonly Charge[];
    readonly payments: readonly Payment[];
  };
}): BillingWiring => {
  const store = createInMemoryBillingStore({
    members: deps.access.members,
    admin: deps.access.admin,
    state: deps.state,
  });
  const shared = {
    subscriptions: store.subscriptions,
    plans: store.plans,
    usage: store.usage,
    clock: deps.clock,
    graceDays: BILLING_GRACE_DAYS,
  };
  // ONE charge store + ONE payment store, shared by every ledger use case, so a
  // recorded payment / void / refund is visible to the next coverage or ledger
  // read (they were ephemeral before, so mutations vanished). The Postgres
  // charge/payment adapters slot in here later, keyed on the same deps.
  const ledger = makeBillingLedgerUseCases({
    subscriptions: store.subscriptions,
    plans: store.plans,
    charges: createInMemoryChargeStore(deps.ledgerSeed?.charges),
    payments: createInMemoryPaymentStore(deps.ledgerSeed?.payments),
    clock: deps.clock,
    ids: deps.ids.next,
    policy: {
      dormantDays: 90,
      graceDays: 10,
      currency: 'MXN',
      taxRateBps: 1600,
    },
  });
  return {
    plans: makeBillingPlansUseCases({
      plans: store.plans,
      clock: deps.clock,
      ids: deps.ids,
    }),
    subscriptions: makeBillingSubscriptionsUseCases(shared),
    guards: makeEntitlementGuards(shared),
    ledger,
    getCoverage: ledger.getCoverage,
    store,
  };
};
