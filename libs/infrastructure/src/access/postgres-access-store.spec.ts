import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accessStoreContract } from '../testing/access-store-contract';
import { identityOnboardingContract } from '../testing/identity-onboarding-contract';
import {
  POSTGRES_TEST_URL,
  acquirePostgresTestLock,
  probePostgres,
} from '../testing/postgres-test-env';
import { createPostgresAccessStore } from './postgres/postgres-access-store';
import { applyPostgresAccessSeed } from './postgres/seed';

/**
 * Runs the SAME contract suites as the in-memory store, against the local
 * Supabase Postgres (no credentials — well-known local dev connection).
 * Skips with a visible notice when the stack is not running (CI without
 * Docker, a laptop with `supabase stop`).
 */
const DATABASE_URL = POSTGRES_TEST_URL;
const available = await probePostgres();

if (available) {
  const store = createPostgresAccessStore({
    databaseUrl: DATABASE_URL,
    maxConnections: 4,
  });
  let releaseLock: (() => Promise<void>) | null = null;
  beforeAll(async () => {
    releaseLock = await acquirePostgresTestLock();
  }, 60_000);
  afterAll(async () => {
    await store.close();
    await releaseLock?.();
  });
  const makeStore = async (
    seed: Parameters<typeof applyPostgresAccessSeed>[1],
  ) => {
    await applyPostgresAccessSeed(DATABASE_URL, seed);
    return store;
  };
  accessStoreContract('postgres (supabase local)', makeStore);
  identityOnboardingContract('postgres (supabase local)', makeStore);
} else {
  describe('AccessStore contract: postgres (supabase local)', () => {
    it('skipped — local Supabase is not running (`supabase start`)', (ctx) => {
      ctx.skip();
      expect(available).toBe(true);
    });
  });
}
