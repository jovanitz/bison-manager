import { planCatalogContract } from './plan-catalog-contract';
import { subscriptionContract } from './subscription-contract';
import type { MakeBillingStore } from './billing-store-fixtures';

/**
 * Contract every billing store (in-memory, Postgres) must satisfy
 * identically; `makeStore` must return exactly the given seed (DBs isolate
 * per call). Split by port — catalog (seed/CAS/default/preview) and
 * subscription (upsert/trial/usage) — the `accessStoreContract` composition
 * precedent.
 */
export const billingStoreContract = (
  name: string,
  makeStore: MakeBillingStore,
): void => {
  planCatalogContract(name, makeStore);
  subscriptionContract(name, makeStore);
};
