import type { AccessMemberDirectory } from '@acme/application';
import type {
  AccessPermission,
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
  UserId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { hasOtherAdminLocked } from '../admin-repository';
import { insertAuditEvent, isUuid } from '../rows';

/**
 * Member management of one account. Removal is one transaction: GoTrue
 * sessions of the member die first (refresh tokens), then the membership row
 * — our sessions/grants cascade with it — then the audit event.
 */
export const createPostgresMemberDirectory = (
  sql: Sql,
): AccessMemberDirectory => ({
  listMembers: async (accountId) => {
    if (!isUuid(accountId)) return [];
    const rows = await sql`
      select id, user_id, permissions
      from public.memberships
      where account_id = ${accountId}
      order by created_at asc
    `;
    return rows.map((row) => ({
      membershipId: row['id'] as MembershipId,
      userId: row['user_id'] as UserId,
      permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
    }));
  },

  removeMember: (membershipId, event, requireCoAdmin) =>
    sql.begin(async (tx) => {
      if (requireCoAdmin && !(await hasOtherAdminLocked(tx, membershipId))) {
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
