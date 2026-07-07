import postgres from 'postgres';
import type {
  EntitlementUsageReader,
  PlanCatalogStore,
  SubscriptionStore,
} from '@acme/application';
import {
  createPostgresPlanCatalogStore,
  seedDefaultBillingPlans,
} from './plan-catalog-store';
import { createPostgresSubscriptionStore } from './subscription-store';
import { createPostgresEntitlementUsageReader } from './usage-reader';

/**
 * The Postgres/Supabase implementation of every billing port — same shape as
 * `createInMemoryBillingStore`, same contract test. The connection string is
 * the *service* connection (bypasses RLS): billing authorization
 * (`plans.manage`/`billing.read`) is enforced in the application layer, and
 * the billing tables carry NO client policies (hidden plan names must never
 * leak through PostgREST).
 *
 * `close()` drains the pool — call it on app shutdown (and afterAll in specs).
 */
export type PostgresBillingStore = {
  readonly plans: PlanCatalogStore;
  readonly subscriptions: SubscriptionStore;
  readonly usage: EntitlementUsageReader;
  /** Idempotent code-floor seeding (`on conflict (key) do nothing`). */
  readonly seedDefaults: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export const createPostgresBillingStore = (config: {
  readonly databaseUrl: string;
  readonly maxConnections?: number;
}): PostgresBillingStore => {
  const sql = postgres(config.databaseUrl, {
    max: config.maxConnections ?? 10,
    onnotice: () => undefined,
  });
  return {
    plans: createPostgresPlanCatalogStore(sql),
    subscriptions: createPostgresSubscriptionStore(sql),
    usage: createPostgresEntitlementUsageReader(sql),
    seedDefaults: () => seedDefaultBillingPlans(sql),
    close: () => sql.end(),
  };
};
