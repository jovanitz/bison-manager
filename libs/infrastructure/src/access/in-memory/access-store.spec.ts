import { accessStoreContract } from '../../testing/access/access-store-contract';
import { identityOnboardingContract } from '../../testing/access/identity/onboarding-contract';
import { sessionPolicyContract } from '../../testing/access/session-policy-contract';
import { toBillingStoreState } from '../../billing/in-memory/billing-store-state';
import { createInMemorySubscriptionStore } from '../../billing/in-memory/in-memory-subscription-store';
import type { InMemoryAccessSeed } from './seed/access-seed';
import { createInMemoryAccessStore } from './access-store';

/**
 * One access store + the billing world its onboarding writes into (ADR-0016):
 * the birth sink IS `createInMemorySubscriptionStore` over the same state the
 * contract reads back through `billing`. The code-floor seeding of
 * `toBillingStoreState` provides the default plan.
 */
const makeStore = (seed: InMemoryAccessSeed) => {
  const billingState = toBillingStoreState();
  const subscriptions = createInMemorySubscriptionStore(billingState);
  return {
    ...createInMemoryAccessStore(seed, subscriptions),
    billing: {
      subscriptions,
      defaultPlan: async () =>
        [...billingState.plans.values()].find((p) => p.isDefaultForNewOrgs) ??
        null,
      events: async () => [...billingState.events],
    },
  };
};

// The in-memory store is the reference implementation of the access ports;
// the Postgres/Supabase adapter runs these exact suites (see
// ./postgres-access-store.spec.ts).
accessStoreContract('in-memory', makeStore);
identityOnboardingContract('in-memory', makeStore);
sessionPolicyContract('in-memory', makeStore);
