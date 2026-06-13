import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { Row, TransactionSql } from 'postgres';
import {
  POSTGRES_TEST_URL,
  acquirePostgresTestLock,
  probePostgres,
} from '../../testing/postgres-test-env';
import { rlsIds, seedRlsWorld } from './postgres-rls-fixtures';

/**
 * Verifies the SECOND line of defense directly against local Supabase: RLS
 * lets an authenticated client read exactly its own rows and write nothing;
 * anon sees nothing; the audit trail is invisible to every client role; and
 * the pg_cron expiry function records `grant.expired` punctually and once.
 * (First line — the application policy core — is tested everywhere else.)
 */
const DATABASE_URL = POSTGRES_TEST_URL;
const available = await probePostgres();

if (available) {
  const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => undefined });
  let releaseLock: (() => Promise<void>) | null = null;
  beforeAll(async () => {
    releaseLock = await acquirePostgresTestLock();
  }, 60_000);
  afterAll(async () => {
    await sql.end();
    await releaseLock?.();
  });

  const asRole = async <T>(
    role: 'anon' | 'authenticated',
    userId: string | null,
    fn: (tx: TransactionSql) => Promise<T>,
  ): Promise<T> =>
    sql.begin(async (tx) => {
      if (userId) {
        await tx`select set_config('request.jwt.claims',
          ${JSON.stringify({ sub: userId, role })}, true)`;
      }
      await tx`select set_config('role', ${role}, true)`;
      return fn(tx);
    });

  const countRows = async (
    tx: TransactionSql,
    table: string,
  ): Promise<number> => {
    const qualified = 'public.' + table;
    const rows = await tx`select count(*)::int as n from ${tx(qualified)}`;
    return (rows[0] as { n: number }).n;
  };

  const TABLES = [
    'accounts',
    'memberships',
    'sessions',
    'access_grants',
    'audit_events',
  ];

  const idsOf = (rows: ReadonlyArray<Row>): ReadonlyArray<unknown> =>
    rows.map((r) => r['id']);

  describe('RLS second line of defense (supabase local)', () => {
    it('anon sees no rows in any access table', async () => {
      await seedRlsWorld();
      await asRole('anon', null, async (tx) => {
        for (const table of TABLES) {
          expect(await countRows(tx, table), table).toBe(0);
        }
      });
    });

    it('authenticated clients read exactly their own rows', async () => {
      await seedRlsWorld();
      await asRole('authenticated', rlsIds.userA, async (tx) => {
        const accounts = await tx`select id from public.accounts`;
        expect(idsOf(accounts)).toEqual([rlsIds.acctA]);
        const memberships = await tx`select id from public.memberships`;
        expect(idsOf(memberships)).toEqual([rlsIds.membershipA]);
        const sessions = await tx`select id from public.sessions`;
        expect(idsOf(sessions)).toEqual([rlsIds.sessionA]);
        const grants = await tx`select id from public.access_grants`;
        expect(idsOf(grants)).toEqual([rlsIds.grantA]);
      });
      await asRole('authenticated', rlsIds.userB, async (tx) => {
        const accounts = await tx`select id from public.accounts`;
        expect(idsOf(accounts)).toEqual([rlsIds.acctB]);
        expect(await countRows(tx, 'access_grants')).toBe(0);
      });
    });

    it('clients cannot write anything, even their own rows', async () => {
      await seedRlsWorld();
      // A failed statement poisons its transaction, so the expected-error
      // attempt gets its own asRole call and the whole call must reject.
      await expect(
        asRole(
          'authenticated',
          rlsIds.userA,
          (
            tx,
          ) => tx`insert into public.audit_events (type, occurred_at, payload)
             values ('login.failed', now(), '{}')`,
        ),
      ).rejects.toThrow(/row-level security/);
      await asRole('authenticated', rlsIds.userA, async (tx) => {
        const updated = await tx`
          update public.accounts set status = 'disabled'
          where id = ${rlsIds.acctA} returning id`;
        expect(updated).toHaveLength(0);
        const deleted = await tx`
          delete from public.sessions where id = ${rlsIds.sessionA} returning id`;
        expect(deleted).toHaveLength(0);
      });
    });

    it('the audit trail is invisible to every client role', async () => {
      await seedRlsWorld();
      await sql`insert into public.audit_events (type, occurred_at, payload)
        values ('session.revoked', now(), '{}')`;
      await asRole('authenticated', rlsIds.userA, async (tx) => {
        expect(await countRows(tx, 'audit_events')).toBe(0);
      });
    });

    it('record_expired_access_grants records punctually, once, with the app payload shape', async () => {
      await seedRlsWorld();
      const first =
        await sql`select public.record_expired_access_grants() as n`;
      expect((first[0] as { n: number }).n).toBe(1);

      const grant = await sql`
        select expiry_recorded_at from public.access_grants where id = ${rlsIds.grantA}`;
      expect(grant[0]?.['expiry_recorded_at']).not.toBeNull();

      const events = await sql`
        select payload from public.audit_events where type = 'grant.expired'`;
      expect(events).toHaveLength(1);
      expect(events[0]?.['payload']).toMatchObject({
        type: 'grant.expired',
        grantId: rlsIds.grantA,
        membershipId: rlsIds.membershipA,
        targetAccountId: rlsIds.acctB,
      });
      expect(
        (events[0]?.['payload'] as { occurredAt: string }).occurredAt,
      ).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const second =
        await sql`select public.record_expired_access_grants() as n`;
      expect((second[0] as { n: number }).n).toBe(0);
    });

    it('clients cannot run the expiry function', async () => {
      await seedRlsWorld();
      await expect(
        asRole(
          'authenticated',
          rlsIds.userA,
          (tx) => tx`select public.record_expired_access_grants()`,
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('schedules the pg_cron job when the extension is available', async () => {
      const ext =
        await sql`select 1 from pg_extension where extname = 'pg_cron'`;
      if (ext.length === 0) return; // lazy recording still covers correctness
      const job = await sql`
        select schedule from cron.job where jobname = 'record-expired-access-grants'`;
      expect(job).toHaveLength(1);
      expect(job[0]?.['schedule']).toBe('* * * * *');
    });
  });
} else {
  describe('RLS second line of defense (supabase local)', () => {
    it('skipped — local Supabase is not running (`supabase start`)', (ctx) => {
      ctx.skip();
      expect(available).toBe(true);
    });
  });
}
