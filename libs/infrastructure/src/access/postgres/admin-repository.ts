import type {
  AccessAdminRepository,
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
} from '@acme/application';
import type {
  AccessAccountDisabled,
  AccessAccountEnabled,
  AccessAccountPromoted,
  AccessPermission,
  AccessSessionPolicy,
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import {
  findSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
} from './admin-sessions';
import { insertAuditEvent, isUuid } from './rows';
import type { SqlLike } from './rows';

/**
 * Administrative mutations. Every write runs mutation + audit event in one
 * transaction (`sql.begin`) — the atomicity the port signature promises.
 * Session methods live in ./admin-sessions (same rules, split for size).
 */
const findAccount = async (
  sql: Sql,
  id: AccountId,
): Promise<AdminAccountSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select a.id, a.status, a.kind,
      exists (
        select 1 from public.memberships m
        where m.account_id = a.id and m.is_root
      ) as hosts_root
    from public.accounts a where a.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as AccountId,
    status: row['status'] as AccountStatus,
    kind: row['kind'] as AccountKind,
    hostsRoot: row['hosts_root'] as boolean,
  };
};

const findMembership = async (
  sql: Sql,
  id: MembershipId,
): Promise<AdminMembershipSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select m.id, m.account_id, m.permissions, m.is_root, m.is_account_owner,
      a.kind
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as MembershipId,
    accountId: row['account_id'] as AccountId,
    accountKind: row['kind'] as AccountKind,
    permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
    isRoot: row['is_root'] as boolean,
    isAccountOwner: row['is_account_owner'] as boolean,
  };
};

/**
 * Within a transaction: locks the account's administrator rows (memberships
 * holding `permissions.update`) and reports whether one OTHER than `exceptId`
 * exists. The `for update` lock serializes concurrent demotions/removals on
 * the same account, so the anti-orphan check cannot be raced.
 */
export const hasOtherAdminLocked = async (
  tx: SqlLike,
  membershipId: string,
): Promise<boolean> => {
  const owner = await tx`
    select account_id from public.memberships where id = ${membershipId}
  `;
  const accountId = owner[0]?.['account_id'] as string | undefined;
  if (!accountId) return true; // no row to orphan
  const admins = await tx`
    select id from public.memberships
    where account_id = ${accountId}
      and permissions @? '$[*] ? (@.action == "permissions.update")'
    for update
  `;
  return admins.some((row) => row['id'] !== membershipId);
};

const promoteAccountToStaff = async (
  sql: Sql,
  id: AccountId,
  event: AccessAccountPromoted,
  staffPolicy: AccessSessionPolicy,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`
      update public.accounts set kind = 'staff' where id = ${id}
    `;
    await tx`
      update public.sessions s
      set expires_at = least(
        s.expires_at,
        coalesce(s.last_seen_at, s.created_at) +
          ${staffPolicy.idleTtlMs}::bigint * interval '1 millisecond',
        s.created_at +
          ${staffPolicy.maxLifetimeMs}::bigint * interval '1 millisecond'
      )
      from public.memberships m
      where m.id = s.membership_id
        and m.account_id = ${id}
        and s.status = 'active'
    `;
    await insertAuditEvent(tx, event);
  });
};

/** disable/enable share one audited UPDATE; only the patch differs. */
const setAccountStatus = async (
  sql: Sql,
  id: AccountId,
  patch: {
    readonly status: 'active' | 'disabled';
    readonly disabledAt: string | null;
  },
  event: AccessAccountDisabled | AccessAccountEnabled,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`
      update public.accounts
      set status = ${patch.status}, disabled_at = ${patch.disabledAt}
      where id = ${id}
    `;
    await insertAuditEvent(tx, event);
  });
};

export const createPostgresAdminRepository = (
  sql: Sql,
): AccessAdminRepository => ({
  findAccount: (id) => findAccount(sql, id),
  findMembership: (id) => findMembership(sql, id),
  findSession: (id) => findSession(sql, id),
  listSessions: (membershipId) => listSessions(sql, membershipId),

  disableAccount: (id, event) =>
    setAccountStatus(
      sql,
      id,
      { status: 'disabled', disabledAt: event.occurredAt },
      event,
    ),

  enableAccount: (id, event) =>
    setAccountStatus(sql, id, { status: 'active', disabledAt: null }, event),

  promoteAccountToStaff: (id, event, staffPolicy) =>
    promoteAccountToStaff(sql, id, event, staffPolicy),

  updatePermissions: (id, permissions, event, requireCoAdmin) =>
    sql.begin(async (tx) => {
      if (requireCoAdmin && !(await hasOtherAdminLocked(tx, id))) {
        return { orphaned: true };
      }
      await tx`
        update public.memberships
        set permissions = ${tx.json(permissions as never)}
        where id = ${id}
      `;
      await insertAuditEvent(tx, event);
      return { orphaned: false };
    }) as Promise<{ readonly orphaned: boolean }>,

  assignRoles: (id, roleIds, event) =>
    sql.begin(async (tx) => {
      await tx`
        update public.memberships
        set role_ids = ${roleIds as unknown as string[]}::uuid[]
        where id = ${id}
      `;
      await insertAuditEvent(tx, event);
    }) as Promise<void>,

  revokeSession: (id, event) => revokeSession(sql, id, event),

  revokeAllSessions: (membershipId, template) =>
    revokeAllSessions(sql, membershipId, template),
});
