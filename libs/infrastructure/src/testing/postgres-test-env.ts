import postgres from 'postgres';

/**
 * Shared plumbing for specs that run against the local Supabase Postgres.
 * No credentials: the connection string is the well-known local dev one.
 * Specs probe first and skip visibly when the stack is down.
 */
export const POSTGRES_TEST_URL =
  process.env['SUPABASE_DB_URL'] ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export const probePostgres = async (): Promise<boolean> => {
  const sql = postgres(POSTGRES_TEST_URL, { max: 1, connect_timeout: 3 });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
};

const POSTGRES_TEST_LOCK = 8_246_001;

/**
 * Cross-file mutex: every postgres spec file wipes and re-seeds the same
 * local database, so two files running in parallel corrupt each other. An
 * advisory lock serializes them regardless of which runner (project or
 * workspace) schedules the files. Acquire in beforeAll, release in afterAll.
 */
export const acquirePostgresTestLock = async (): Promise<
  () => Promise<void>
> => {
  const sql = postgres(POSTGRES_TEST_URL, { max: 1 });
  await sql`select pg_advisory_lock(${POSTGRES_TEST_LOCK})`;
  return async () => {
    await sql`select pg_advisory_unlock(${POSTGRES_TEST_LOCK})`;
    await sql.end();
  };
};
