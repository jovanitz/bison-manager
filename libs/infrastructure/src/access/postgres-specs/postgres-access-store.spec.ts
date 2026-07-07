import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { BillingEvent, PlanId } from '@acme/domain';
import { accessStoreContract } from '../../testing/access/access-store-contract';
import { identityOnboardingContract } from '../../testing/access/identity/onboarding-contract';
import { sessionPolicyContract } from '../../testing/access/session-policy-contract';
import { freePlanDrifted } from '../../testing/billing/billing-store-fixtures';
import {
  POSTGRES_TEST_URL,
  acquirePostgresTestLock,
  probePostgres,
} from '../../testing/postgres-test-env';
import { createPostgresBillingStore } from '../../billing/postgres/postgres-billing-store';
import { createPostgresAccessStore } from '../postgres/postgres-access-store';
import type { applyPostgresAccessSeed } from '../../testing/postgres-access-seed';
import { applyPostgresBillingSeed } from '../../testing/postgres-billing-seed';

/**
 * Runs the SAME contract suites as the in-memory store, against the local
 * Supabase Postgres (no credentials — well-known local dev connection).
 * Skips with a visible notice when the stack is not running (CI without
 * Docker, a laptop with `supabase stop`). Each world also wipes + seeds the
 * billing tables with a default free plan: onboarding births subscriptions
 * (ADR-0016) and the contract reads them back through `billing`.
 */
const DATABASE_URL = POSTGRES_TEST_URL;
const available = await probePostgres();

if (available) {
  const store = createPostgresAccessStore({
    databaseUrl: DATABASE_URL,
    maxConnections: 4,
  });
  const billingStore = createPostgresBillingStore({
    databaseUrl: DATABASE_URL,
    maxConnections: 2,
  });
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
  let releaseLock: (() => Promise<void>) | null = null;
  beforeAll(async () => {
    releaseLock = await acquirePostgresTestLock();
  }, 60_000);
  afterAll(async () => {
    await store.close();
    await billingStore.close();
    await sql.end();
    await releaseLock?.();
  });
  const makeStore = async (
    seed: Parameters<typeof applyPostgresAccessSeed>[1],
  ) => {
    await applyPostgresBillingSeed(DATABASE_URL, {
      access: seed,
      billing: { plans: [freePlanDrifted(crypto.randomUUID() as PlanId)] },
    });
    return {
      ...store,
      billing: {
        subscriptions: billingStore.subscriptions,
        defaultPlan: billingStore.plans.findDefaultPlan,
        events: async () =>
          (
            await sql`select payload from public.billing_events order by seq asc`
          ).map((row) => row['payload'] as BillingEvent),
      },
    };
  };
  accessStoreContract('postgres (supabase local)', makeStore);
  identityOnboardingContract('postgres (supabase local)', makeStore);
  sessionPolicyContract('postgres (supabase local)', makeStore);
} else {
  describe('AccessStore contract: postgres (supabase local)', () => {
    it('skipped — local Supabase is not running (`supabase start`)', (ctx) => {
      ctx.skip();
      expect(available).toBe(true);
    });
  });
}
