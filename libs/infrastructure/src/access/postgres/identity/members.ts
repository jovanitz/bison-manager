import type { AccessMemberDirectory } from '@acme/application';
import type {
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
  RoleId,
  UserId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { removeWouldOrphanLocked } from '../admin/anti-orphan';
import { oneOffFromRow } from '../admin/personal-role';
import { insertAuditEvent, isUuid } from '../rows';

/**
 * Members of one account: each member's editable one-off permissions (direct ∪
 * personal role) plus its shared-role ids (the personal role excluded).
 */
const listAccountMembers = async (sql: Sql, accountId: string) => {
  if (!isUuid(accountId)) return [];
  const rows = await sql`
    select m.id, m.user_id, m.role_ids, m.is_root,
      m.blocked, coalesce(pr.permissions, '[]'::jsonb) as personal,
      pr.id as personal_id
    from public.memberships m
    left join lateral (
      select r.id, r.permissions from public.roles r
      where r.is_personal and r.id = any(m.role_ids) limit 1
    ) pr on true
    where m.account_id = ${accountId}
    order by m.created_at asc
  `;
  return rows.map((row) => ({
    membershipId: row['id'] as MembershipId,
    userId: row['user_id'] as UserId,
    permissions: oneOffFromRow(row),
    roleIds: ((row['role_ids'] as string[] | null) ?? []).filter(
      (rid) => rid !== row['personal_id'],
    ) as unknown as ReadonlyArray<RoleId>,
    isRoot: row['is_root'] as boolean,
    blocked: row['blocked'] as boolean,
  }));
};

/**
 * Member management of one account. Removal is one transaction: GoTrue
 * sessions of the member die first (refresh tokens), then the membership row
 * — our sessions/grants cascade with it — then the audit event.
 */
export const createPostgresMemberDirectory = (
  sql: Sql,
): AccessMemberDirectory => ({
  listMembers: (accountId) => listAccountMembers(sql, accountId),

  removeMember: (membershipId, event, requireCoAdmin) =>
    sql.begin(async (tx) => {
      if (requireCoAdmin && (await removeWouldOrphanLocked(tx, membershipId))) {
        return { orphaned: true };
      }
      const sessions = await tx`
        select id from public.sessions where membership_id = ${membershipId}
      `;
      for (const row of sessions) {
        await tx`delete from auth.sessions where id = ${row['id'] as string}`;
      }
      // our sessions and grants cascade with the membership row
      await tx`delete from public.memberships where id = ${membershipId}`;
      await insertAuditEvent(tx, event);
      return { orphaned: false };
    }) as Promise<{ readonly orphaned: boolean }>,

  listMembershipsByUser: async (userId) => {
    if (!isUuid(userId)) return [];
    const rows = await sql`
      select m.id, m.account_id, a.kind, a.status, a.display_name
      from public.memberships m
      join public.accounts a on a.id = m.account_id
      where m.user_id = ${userId}
      order by m.created_at asc
    `;
    return rows.map((row) => ({
      membershipId: row['id'] as MembershipId,
      accountId: row['account_id'] as AccountId,
      accountKind: row['kind'] as AccountKind,
      accountStatus: row['status'] as AccountStatus,
      accountName: (row['display_name'] as string | null) ?? null,
    }));
  },

  switchSession: async (sessionId, toMembershipId, expiresAt, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.sessions
        set membership_id = ${toMembershipId},
            expires_at = ${expiresAt},
            last_seen_at = ${event.occurredAt}
        where id = ${sessionId}
      `;
      await insertAuditEvent(tx, event);
    });
  },
});
