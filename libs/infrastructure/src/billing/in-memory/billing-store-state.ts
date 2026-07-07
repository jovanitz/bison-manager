import { DEFAULT_PLANS } from '@acme/domain';
import type {
  BillingEvent,
  Plan,
  PlanId,
  PlanSeed,
  Subscription,
} from '@acme/domain';

/**
 * Shared state for the in-memory billing adapters (ADR-0016) — the
 * `AccessStoreState` analog. One state object, several port factories over
 * it: a write that pairs a mutation with its billing event lands both in the
 * same synchronous step (= the Postgres transaction). Billing events are
 * their OWN append-only stream — never the access audit union.
 */
export type StoredSubscription = {
  readonly sub: Subscription;
  /** CAS marker for exactly-once `subscription.trial-expired` recording. */
  readonly trialExpiryRecordedAt: string | null;
};

export type InMemoryBillingSeed = {
  readonly plans?: ReadonlyArray<Plan>;
  readonly subscriptions?: ReadonlyArray<Subscription>;
};

export type BillingStoreState = {
  /** The staff-editable catalog, keyed by plan id. */
  readonly plans: Map<string, Plan>;
  /** One per customer account — keyed by accountId (`unique(account_id)`). */
  readonly subscriptions: Map<string, StoredSubscription>;
  /** Billing's own audit stream, in write order (`billing_events.seq`). */
  readonly events: BillingEvent[];
};

const planFromSeed = (seed: PlanSeed): Plan => ({
  id: crypto.randomUUID() as PlanId,
  key: seed.key,
  displayName: seed.displayName,
  internalNote: seed.internalNote,
  status: 'active',
  visibility: seed.visibility,
  isDefaultForNewOrgs: seed.isDefaultForNewOrgs,
  entitlements: seed.entitlements,
  trialMonths: seed.trialMonths,
  price: seed.price,
  priceSetAt: seed.price === null ? null : new Date().toISOString(),
  version: 1,
});

/**
 * Idempotent code-floor seeding — the in-memory analog of the migration's
 * `on conflict (key) do nothing` insert (the `ROLE_TEMPLATES` precedent): a
 * key already present (e.g. a staff-edited live plan) is never overwritten,
 * and seeding emits no audit event.
 */
export const seedDefaultBillingState = (state: BillingStoreState): void => {
  const taken = new Set([...state.plans.values()].map((plan) => plan.key));
  for (const seed of DEFAULT_PLANS) {
    if (taken.has(seed.key)) continue;
    const plan = planFromSeed(seed);
    state.plans.set(plan.id, plan);
  }
};

export const toBillingStoreState = (
  seed?: InMemoryBillingSeed,
): BillingStoreState => {
  const state: BillingStoreState = {
    plans: new Map(
      (seed?.plans ?? []).map((plan) => [plan.id as string, plan]),
    ),
    subscriptions: new Map(
      (seed?.subscriptions ?? []).map((sub) => [
        sub.accountId,
        { sub, trialExpiryRecordedAt: null },
      ]),
    ),
    events: [],
  };
  seedDefaultBillingState(state);
  return state;
};
