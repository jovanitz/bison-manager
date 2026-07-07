import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  EntitlementUsageReader,
  PlanCatalogStore,
  SubscriptionStore,
} from '@acme/application';
import type { AccountId, BillingEvent } from '@acme/domain';
import { makeEntitlementUsageReader } from '../usage/entitlement-usage-reader';
import {
  seedDefaultBillingState,
  toBillingStoreState,
} from './billing-store-state';
import type {
  BillingStoreState,
  InMemoryBillingSeed,
} from './billing-store-state';
import { createInMemoryPlanCatalogStore } from './in-memory-plan-catalog-store';
import { createInMemorySubscriptionStore } from './in-memory-subscription-store';

/**
 * In-memory implementation of every billing port (ADR-0016) — the reference
 * the Postgres adapters are contract-tested against, mirroring
 * `createInMemoryAccessStore`: one factory, one shared state; every write
 * lands mutation + billing event together (synchronous = atomic here; the
 * real adapters use a transaction). The catalog is seeded from
 * `DEFAULT_PLANS` — the `ROLE_TEMPLATES` code-floor analog — and usage
 * counting composes over the EXISTING access store surface, where
 * memberships and ownership already live.
 */
export type InMemoryBillingStore = {
  readonly plans: PlanCatalogStore;
  readonly subscriptions: SubscriptionStore;
  readonly usage: EntitlementUsageReader;
  /** Billing's OWN append-only audit stream (never the access union). */
  readonly events: ReadonlyArray<BillingEvent>;
  /** Re-apply the code floor — idempotent, like the migration seed. */
  readonly seedDefaults: () => Promise<void>;
};

export const createInMemoryBillingStore = (deps: {
  readonly members: Pick<
    AccessMemberDirectory,
    'listMembers' | 'listMembershipsByUser'
  >;
  readonly admin: Pick<AccessAdminRepository, 'findMembership'>;
  readonly seed?: InMemoryBillingSeed;
  /**
   * Pre-built shared state (wins over `seed`): the composition root creates
   * it FIRST so the identity onboarding's birth writes (ADR-0016) land in the
   * same maps these stores read.
   */
  readonly state?: BillingStoreState;
}): InMemoryBillingStore => {
  const state = deps.state ?? toBillingStoreState(deps.seed);
  const subscriptions = createInMemorySubscriptionStore(state);
  const plans = createInMemoryPlanCatalogStore(state, {
    countMembers: async (accountId) =>
      (await deps.members.listMembers(accountId as AccountId)).length,
  });
  return {
    plans,
    subscriptions,
    usage: makeEntitlementUsageReader({
      members: deps.members,
      admin: deps.admin,
      subscriptions,
      plans,
    }),
    events: state.events,
    seedDefaults: async () => seedDefaultBillingState(state),
  };
};
