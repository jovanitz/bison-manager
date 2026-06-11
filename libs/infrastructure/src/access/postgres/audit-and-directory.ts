import type { AccessAuditTrail, CustomerDirectory } from '@acme/application';
import type { AccessAuditEvent, AccountId } from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid, isoOf } from './rows';

/**
 * The audit trail reads the full event back from `payload` (the columns are
 * filter denormalizations); ordering is the append ordinal `seq`, so listing
 * is stable even when events share a timestamp.
 */
export const createPostgresAuditTrail = (sql: Sql): AccessAuditTrail => ({
  append: async (event) => {
    await insertAuditEvent(sql, event);
  },

  list: async (filter) => {
    const rows = await sql`
      select id, payload from public.audit_events
      where true
      ${filter?.types ? sql`and type in ${sql([...filter.types])}` : sql``}
      ${filter?.accountId ? sql`and account_id = ${filter.accountId}` : sql``}
      order by seq asc
      ${filter?.limit === undefined ? sql`` : sql`limit ${filter.limit}`}
    `;
    return rows.map((row) => ({
      id: row['id'] as string,
      event: row['payload'] as AccessAuditEvent,
    }));
  },
});

/**
 * Security invariant (see the impersonation use cases): only accounts with
 * kind='customer' are ever visible here. A staff account surfacing in this
 * directory would become an impersonation target for support.
 */
export const createPostgresCustomerDirectory = (
  sql: Sql,
): CustomerDirectory => ({
  search: async (query) => {
    const needle = `%${query.replaceAll(/[%_\\]/g, '\\$&')}%`;
    const rows = await sql`
      select id, display_name, email from public.accounts
      where kind = 'customer'
        and (display_name ilike ${needle} or email ilike ${needle})
      order by display_name asc
    `;
    return rows.map((row) => ({
      accountId: row['id'] as AccountId,
      displayName: row['display_name'] as string,
      email: row['email'] as string | null,
    }));
  },

  read: async (accountId) => {
    if (!isUuid(accountId)) return null;
    const rows = await sql`
      select id, display_name, email, status, created_at
      from public.accounts
      where kind = 'customer' and id = ${accountId}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      accountId: row['id'] as AccountId,
      displayName: row['display_name'] as string,
      email: row['email'] as string | null,
      status: row['status'] as string,
      createdAt: isoOf(row['created_at'] as Date),
    };
  },
});
