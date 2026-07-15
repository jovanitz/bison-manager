import type {
  AccessAuditTrail,
  CustomerDirectory,
  StaffDirectory,
} from '@acme/application';
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

/**
 * The platform staff directory — the mirror image of the customer one: it lists
 * exactly the accounts the customer directory hides (`kind='staff'`). Read-only
 * and account-spanning; the `staff.read` policy check happens in the use case.
 */
const listCustomerAccounts = async (sql: Sql) => {
  const rows = await sql`
    select
      a.id,
      a.display_name,
      a.email,
      a.status,
      a.blocked,
      a.pending_deletion_until,
      (
        select count(*) from public.memberships m where m.account_id = a.id
      )::int as member_count
    from public.accounts a
    where a.kind = 'customer'
    order by a.display_name asc
  `;
  return rows.map((row) => ({
    accountId: row['id'] as AccountId,
    displayName: row['display_name'] as string,
    email: row['email'] as string | null,
    blocked: row['blocked'] as boolean,
    disabled: (row['status'] as string) === 'disabled',
    memberCount: row['member_count'] as number,
    pendingDeletionUntil: row['pending_deletion_until']
      ? new Date(row['pending_deletion_until'] as Date).toISOString()
      : null,
  }));
};

export const createPostgresStaffDirectory = (sql: Sql): StaffDirectory => ({
  // LEFT JOIN, not INNER: an account with no membership yet must still be
  // listed (it would silently vanish from the staff table otherwise). `blocked`
  // is the IDENTITY block (keyed by user_id) — the org-level `accounts.blocked`
  // is a different axis and belongs to the customer rows.
  listStaff: async () => {
    const rows = await sql`
      select
        a.id,
        a.display_name,
        a.email,
        a.status,
        m.user_id,
        coalesce(m.is_root, false) as is_root,
        exists (
          select 1 from public.blocked_identities bi
          where bi.user_id = m.user_id
        ) as blocked
      from public.accounts a
      left join public.memberships m on m.account_id = a.id
      where a.kind = 'staff'
      order by a.email asc nulls last, a.id asc
    `;
    return rows.map((row) => ({
      accountId: row['id'] as AccountId,
      userId: (row['user_id'] as string | null) ?? '',
      email: row['email'] as string | null,
      displayName: row['display_name'] as string | null,
      blocked: row['blocked'] as boolean,
      disabled: (row['status'] as string) === 'disabled',
      isRoot: row['is_root'] as boolean,
    }));
  },

  listCustomerAccounts: async () => listCustomerAccounts(sql),
  // Org-less "zombies": auth identities with no membership in any account.
  // Cross-schema (auth.users ⋈ public.memberships) — only the real DB can answer.
  listOrphanIdentities: async () => {
    const rows = await sql`
      select u.id, u.email, u.created_at
      from auth.users u
      where not exists (
        select 1 from public.memberships m where m.user_id = u.id
      )
      order by u.created_at asc
    `;
    return rows.map((row) => ({
      userId: row['id'] as string,
      email: row['email'] as string | null,
      createdAt: new Date(row['created_at'] as string | Date).toISOString(),
    }));
  },
});
