import { billingStoreContract } from '../../testing/billing/billing-store-contract';
import { createInMemoryAccessStore } from '../../access/in-memory-access-store';
import { createInMemoryBillingStore } from './in-memory-billing-store';

// The in-memory store is the reference implementation of the billing ports;
// the Postgres/Supabase adapter runs this exact suite (see
// ../postgres-specs/postgres-billing-store.spec.ts). Usage counting composes
// over the in-memory ACCESS store — memberships and ownership live there.
billingStoreContract('in-memory', (seed) => {
  const access = createInMemoryAccessStore(seed.access);
  const store = createInMemoryBillingStore({
    members: access.members,
    admin: access.admin,
    seed: seed.billing,
  });
  return {
    plans: store.plans,
    subscriptions: store.subscriptions,
    usage: store.usage,
    events: async () => store.events,
    seedDefaults: store.seedDefaults,
  };
});
