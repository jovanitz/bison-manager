import type {
  AccessAdminRepository,
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
  AdminSessionSnapshot,
} from '@acme/application';
import type {
  AccessPermission,
  AccountId,
  AccountStatus,
  MembershipId,
  SessionId,
  SessionStatus,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from './rows';

/**
 * Administrative mutations. Every write runs mutation + audit event in one
 * transaction (`sql.begin`) — the atomicity the port signature promises.
 */
const findAccount = async (
  sql: Sql,
  id: AccountId,
): Promise<AdminAccountSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select id, status from public.accounts where id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as AccountId,
    status: row['status'] as AccountStatus,
  };
};

const findMembership = async (
  sql: Sql,
  id: MembershipId,
): Promise<AdminMembershipSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select id, account_id, permissions from public.memberships where id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as MembershipId,
    accountId: row['account_id'] as AccountId,
    permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
  };
};

const findSession = async (
  sql: Sql,
  id: SessionId,
): Promise<AdminSessionSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select s.id, s.status, m.account_id
    from public.sessions s
    join public.memberships m on m.id = s.membership_id
    where s.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as SessionId,
    accountId: row['account_id'] as AccountId,
    status: row['status'] as SessionStatus,
  };
};

export const createPostgresAdminRepository = (
  sql: Sql,
): AccessAdminRepository => ({
  findAccount: (id) => findAccount(sql, id),
  findMembership: (id) => findMembership(sql, id),
  findSession: (id) => findSession(sql, id),

  disableAccount: async (id, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.accounts
        set status = 'disabled', disabled_at = ${event.occurredAt}
        where id = ${id}
      `;
      await insertAuditEvent(tx, event);
    });
  },

  updatePermissions: async (id, permissions, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.memberships
        set permissions = ${tx.json(permissions as never)}
        where id = ${id}
      `;
      await insertAuditEvent(tx, event);
    });
  },

  revokeSession: async (id, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.sessions
        set status = 'revoked', revoked_at = ${event.occurredAt}
        where id = ${id}
      `;
      // Same transaction: drop GoTrue's session so its refresh tokens die
      // with ours — revocation must also stop token renewal, not just API
      // access. No-op when the row does not exist (tests, stub identities).
      await tx`delete from auth.sessions where id = ${id}`;
      await insertAuditEvent(tx, event);
    });
  },
});
