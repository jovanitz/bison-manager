import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from '@acme/application';
import type {
  AccessInvitationAccepted,
  AccountId,
  AccountKind,
  InvitationId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from '../rows';
import type { SqlLike } from '../rows';

/**
 * Postgres onboarding. Provisioning writes (account + membership [+ event])
 * and session registration (+ login event) each run in one transaction.
 * auth.users rows are GoTrue's: a real sign-in guarantees they exist before
 * this code runs, so nothing here writes to the auth schema.
 */
const listActiveSessions = async (
  sql: Sql,
  membershipId: MembershipId,
  now: string,
): Promise<ReadonlyArray<{ sessionId: SessionId; lastSeenAt: string }>> => {
  if (!isUuid(membershipId)) return [];
  const rows = await sql`
    select id, last_seen_at from public.sessions
    where membership_id = ${membershipId}
      and status = 'active'
      and expires_at > ${now}
  `;
  return rows.map((row) => ({
    sessionId: row['id'] as SessionId,
    lastSeenAt: new Date(row['last_seen_at'] as Date).toISOString(),
  }));
};

const insertMembershipBundle = async (
  tx: SqlLike,
  membership: NewIdentityMembership,
  kind: 'staff' | 'customer',
  isRoot: boolean,
): Promise<void> => {
  await tx`
    insert into public.accounts (id, display_name, email, kind, created_at)
    values (${membership.accountId}, ${membership.displayName},
      ${membership.email}, ${kind}, ${membership.occurredAt})
  `;
  await tx`
    insert into public.memberships
      (id, user_id, account_id, permissions, is_root, created_at)
    values (${membership.membershipId}, ${membership.userId},
      ${membership.accountId}, ${tx.json(membership.permissions as never)},
      ${isRoot}, ${membership.occurredAt})
  `;
};

const acceptInvitation = async (
  sql: Sql,
  input: {
    readonly membership: NewIdentityMembership;
    readonly invitationId: InvitationId;
    readonly event: AccessInvitationAccepted;
  },
): Promise<void> => {
  const { membership, invitationId, event } = input;
  await sql.begin(async (tx) => {
    await tx`
      update public.invitations
      set accepted_at = ${event.occurredAt}
      where id = ${invitationId}
    `;
    await tx`
      insert into public.memberships
        (id, user_id, account_id, permissions, is_root, created_at)
      values (${membership.membershipId}, ${membership.userId},
        ${membership.accountId}, ${tx.json(membership.permissions as never)},
        false, ${membership.occurredAt})
    `;
    await insertAuditEvent(tx, event);
  });
};

export const createPostgresIdentityOnboarding = (
  sql: Sql,
): IdentityOnboardingRepository => ({
  findMembershipByUser: async (userId) => {
    if (!isUuid(userId)) return null;
    const rows = await sql`
      select m.id, m.account_id, a.kind
      from public.memberships m
      join public.accounts a on a.id = m.account_id
      where m.user_id = ${userId}
      order by m.created_at asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membershipId: row['id'] as MembershipId,
      accountId: row['account_id'] as AccountId,
      accountKind: row['kind'] as AccountKind,
    };
  },

  sessionExists: async (sessionId) => {
    if (!isUuid(sessionId)) return false;
    const rows = await sql`
      select 1 from public.sessions where id = ${sessionId}
    `;
    return rows.length > 0;
  },

  rootAdminExists: async () => {
    const rows = await sql`
      select 1 from public.memberships where is_root limit 1
    `;
    return rows.length > 0;
  },

  createOwnerMembership: async (membership, event) => {
    await sql.begin(async (tx) => {
      await insertMembershipBundle(tx, membership, 'staff', true);
      await insertAuditEvent(tx, event);
    });
  },

  createCustomerMembership: async (membership) => {
    await sql.begin(async (tx) => {
      await insertMembershipBundle(tx, membership, 'customer', false);
    });
  },

  acceptInvitation: (membership, invitationId, event) =>
    acceptInvitation(sql, { membership, invitationId, event }),

  createSession: async (session, event) => {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.sessions
          (id, membership_id, expires_at, created_at, last_seen_at,
           user_agent, created_ip, last_ip)
        values (${session.sessionId}, ${session.membershipId},
          ${session.expiresAt}, ${session.createdAt}, ${session.createdAt},
          ${session.context.userAgent}, ${session.context.ipAddress},
          ${session.context.ipAddress})
      `;
      await insertAuditEvent(tx, event);
    });
  },

  listActiveSessions: (membershipId, now) =>
    listActiveSessions(sql, membershipId, now),
});
