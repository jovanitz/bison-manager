import type {
  AccessAdminRepository,
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
} from '@acme/application';
import type {
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
import { assignWouldOrphanLocked, hasOtherAdminLocked } from './anti-orphan';
import { oneOffFromRow, upsertPersonalRole } from './personal-role';
import {
  demoteAccountToCustomer,
  promoteAccountToStaff,
  setAccountStatus,
} from './account-lifecycle';
import { insertAuditEvent, isUuid } from '../rows';

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
    select m.id, m.account_id, m.is_root, m.is_account_owner, a.kind,
      coalesce(pr.permissions, '[]'::jsonb) as personal
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    left join lateral (
      select r.permissions from public.roles r
      where r.is_personal and r.id = any(m.role_ids) limit 1
    ) pr on true
    where m.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as MembershipId,
    accountId: row['account_id'] as AccountId,
    accountKind: row['kind'] as AccountKind,
    permissions: oneOffFromRow(row),
    isRoot: row['is_root'] as boolean,
    isAccountOwner: row['is_account_owner'] as boolean,
  };
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

  demoteAccountToCustomer: (id, event, customerPolicy) =>
    demoteAccountToCustomer(sql, id, event, customerPolicy),

  updatePermissions: (id, permissions, event, requireCoAdmin) =>
    sql.begin(async (tx) => {
      if (requireCoAdmin && !(await hasOtherAdminLocked(tx, id))) {
        return { orphaned: true };
      }
      const rows = await tx`
        select account_id, role_ids from public.memberships
        where id = ${id} for update
      `;
      const accountId = rows[0]?.['account_id'] as string | undefined;
      if (!accountId) return { orphaned: false };
      await upsertPersonalRole(
        tx,
        {
          id,
          accountId,
          roleIds: (rows[0]['role_ids'] as string[] | null) ?? [],
        },
        permissions,
      );
      await insertAuditEvent(tx, event);
      return { orphaned: false };
    }) as Promise<{ readonly orphaned: boolean }>,

  assignRoles: (id, roleIds, event) =>
    sql.begin(async (tx) => {
      // keep the membership's personal role (the one-off slot, never assignable)
      const personal = await tx`
        select r.id from public.roles r
        join public.memberships m on r.id = any(m.role_ids)
        where m.id = ${id} and r.is_personal limit 1
      `;
      const personalId = personal[0]?.['id'] as string | undefined;
      const next = personalId ? [...roleIds, personalId] : [...roleIds];
      if (await assignWouldOrphanLocked(tx, id, next)) {
        return { orphaned: true };
      }
      await tx`
        update public.memberships
        set role_ids = ${next as unknown as string[]}::uuid[]
        where id = ${id}
      `;
      await insertAuditEvent(tx, event);
      return { orphaned: false };
    }) as Promise<{ readonly orphaned: boolean }>,

  revokeSession: (id, event) => revokeSession(sql, id, event),

  revokeAllSessions: (membershipId, template) =>
    revokeAllSessions(sql, membershipId, template),
});
