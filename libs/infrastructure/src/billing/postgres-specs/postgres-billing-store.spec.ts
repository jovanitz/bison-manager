import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { BillingEvent } from '@acme/domain';
import { billingStoreContract } from '../../testing/billing/billing-store-contract';
import { applyPostgresBillingSeed } from '../../testing/postgres-billing-seed';
import {
  POSTGRES_TEST_URL,
  acquirePostgresTestLock,
  probePostgres,
} from '../../testing/postgres-test-env';
import { createPostgresBillingStore } from '../postgres/postgres-billing-store';

/**
 * Runs the SAME contract suite as the in-memory billing store, against the
 * local Supabase Postgres (no credentials — well-known local dev connection).
 * Skips with a visible notice when the stack is not running (CI without
 * Docker, a laptop with `supabase stop`).
 */
const available = await probePostgres();

if (available) {
  const store = createPostgresBillingStore({
    databaseUrl: POSTGRES_TEST_URL,
    maxConnections: 4,
  });
  const sql = postgres(POSTGRES_TEST_URL, {
    max: 1,
    onnotice: () => undefined,
  });
  let releaseLock: (() => Promise<void>) | null = null;
  beforeAll(async () => {
    releaseLock = await acquirePostgresTestLock();
  }, 60_000);
  afterAll(async () => {
    await store.close();
    await sql.end();
    await releaseLock?.();
  });
  billingStoreContract('postgres (supabase local)', async (seed) => {
    await applyPostgresBillingSeed(POSTGRES_TEST_URL, seed);
    return {
      plans: store.plans,
      subscriptions: store.subscriptions,
      usage: store.usage,
      seedDefaults: store.seedDefaults,
      events: async () =>
        (
          await sql`select payload from public.billing_events order by seq asc`
        ).map((row) => row['payload'] as BillingEvent),
    };
  });
} else {
  describe('BillingStore contract: postgres (supabase local)', () => {
    it('skipped — local Supabase is not running (`supabase start`)', (ctx) => {
      ctx.skip();
      expect(available).toBe(true);
    });
  });
}
