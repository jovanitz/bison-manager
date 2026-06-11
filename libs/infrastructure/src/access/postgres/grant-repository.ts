import type {
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
} from '@acme/application';
import type { Sql } from 'postgres';
import { grantFromRow, insertAuditEvent, isUuid } from './rows';

/**
 * Grant persistence. `saveNew`/`saveEnded`/`recordExpiry` pair every mutation
 * with its audit event inside one transaction; `recordExpiry` commits all the
 * lazily-observed expirations of a request atomically.
 */
export const createPostgresGrantRepository = (
  sql: Sql,
): AccessGrantRepository => ({
  findById: async (id) => {
    if (!isUuid(id)) return null;
    const rows = await sql`
      select * from public.access_grants where id = ${id}
    `;
    const row = rows[0];
    return row ? grantFromRow(row as never) : null;
  },

  saveNew: async (grant, event) => {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.access_grants
          (id, kind, membership_id, target_account_id, actions, reason, created_at, expires_at)
        values (
          ${grant.id},
          ${grant.kind},
          ${grant.membershipId},
          ${grant.targetAccountId},
          ${tx.json(grant.actions as never)},
          ${grant.reason},
          ${grant.createdAt},
          ${grant.expiresAt}
        )
      `;
      await insertAuditEvent(tx, event);
    });
  },

  saveEnded: async (grant, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.access_grants
        set revoked_at = ${grant.revokedAt}
        where id = ${grant.id}
      `;
      await insertAuditEvent(tx, event);
    });
  },
});

export const createPostgresGrantExpiryRecorder = (
  sql: Sql,
): AccessGrantExpiryRecorder => ({
  recordExpiry: async (entries) => {
    if (entries.length === 0) return;
    await sql.begin(async (tx) => {
      for (const entry of entries) {
        await tx`
          update public.access_grants
          set expiry_recorded_at = ${entry.grant.expiryRecordedAt}
          where id = ${entry.grant.id}
        `;
        await insertAuditEvent(tx, entry.event);
      }
    });
  },
});
