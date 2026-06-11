import { accessStoreContract } from '../testing/access-store-contract';
import { identityOnboardingContract } from '../testing/identity-onboarding-contract';
import { createInMemoryAccessStore } from './in-memory-access-store';

// The in-memory store is the reference implementation of the access ports;
// the Postgres/Supabase adapter runs these exact suites (see
// ./postgres-access-store.spec.ts).
accessStoreContract('in-memory', (seed) => createInMemoryAccessStore(seed));
identityOnboardingContract('in-memory', (seed) =>
  createInMemoryAccessStore(seed),
);
