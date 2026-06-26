import type {
  AdminSessionDetail,
  AdminSessionSnapshot,
} from '@acme/application';
import type {
  AccessSessionRevoked,
  MembershipId,
  SessionId,
  SessionStatus,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from '../rows';

/**
 * Session half of the admin repository (split file for size limits). Same
 * rules as every access adapter: mutation + audit event in one transaction,
 * and revocation also deletes GoTrue's row so refresh tokens die with ours.
 */
export const findSession = async (
  sql: Sql,
  id: SessionId,
): Promise<AdminSessionSnapshot | null> => {
  if (!isUuid(id)) return null;
  const rows = await sql`
    select s.id, s.status, m.account_id, m.is_root
    from public.sessions s
    join public.memberships m on m.id = s.membership_id
    where s.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row['id'] as SessionId,
    accountId: row['account_id'] as AdminSessionSnapshot['accountId'],
    status: row['status'] as SessionStatus,
    isRoot: row['is_root'] as boolean,
  };
};

const toIso = (value: unknown): string =>
  new Date(value as string).toISOString();

/** Session rows of a membership with their captured context, newest first. */
export const listSessions = async (
  sql: Sql,
  membershipId: MembershipId,
): Promise<ReadonlyArray<AdminSessionDetail>> => {
  if (!isUuid(membershipId)) return [];
  const rows = await sql`
    select id, status, created_at, last_seen_at, expires_at,
           user_agent, created_ip, last_ip
    from public.sessions
    where membership_id = ${membershipId}
    order by coalesce(last_seen_at, created_at) desc
  `;
  return rows.map((row) => ({
    id: row['id'] as SessionId,
    status: row['status'] as SessionStatus,
    createdAt: toIso(row['created_at']),
    lastSeenAt: toIso(row['last_seen_at'] ?? row['created_at']),
    expiresAt: toIso(row['expires_at']),
    userAgent: (row['user_agent'] as string | null) ?? null,
    createdIp: (row['created_ip'] as string | null) ?? null,
    lastIp: (row['last_ip'] as string | null) ?? null,
  }));
};

export const revokeSession = async (
  sql: Sql,
  id: SessionId,
  event: AccessSessionRevoked,
): Promise<void> => {
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
};

export const revokeAllSessions = async (
  sql: Sql,
  membershipId: MembershipId,
  template: {
    readonly actorMembershipId: MembershipId;
    readonly occurredAt: string;
  },
): Promise<number> => {
  if (!isUuid(membershipId)) return 0;
  return await sql.begin(async (tx) => {
    const revoked = await tx`
      update public.sessions
      set status = 'revoked', revoked_at = ${template.occurredAt}
      where membership_id = ${membershipId} and status = 'active'
      returning id
    `;
    for (const row of revoked) {
      const sessionId = row['id'] as string;
      await tx`delete from auth.sessions where id = ${sessionId}`;
      await insertAuditEvent(tx, {
        type: 'session.revoked',
        sessionId: sessionId as never,
        actorMembershipId: template.actorMembershipId,
        occurredAt: template.occurredAt,
      });
    }
    return revoked.length;
  });
};
