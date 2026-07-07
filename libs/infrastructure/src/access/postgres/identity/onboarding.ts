import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from '@acme/application';
import type {
  AccessOwnerBootstrapped,
  AccountId,
  AccountKind,
  BillingSubscriptionStarted,
  MembershipId,
  SessionId,
  Subscription,
} from '@acme/domain';
import type { Sql } from 'postgres';
import {
  insertBillingEvent,
  insertSubscriptionRow,
} from '../../../billing/postgres/rows';
import { upsertPersonalRole } from '../admin/personal-role';
import { insertAuditEvent, isUuid } from '../rows';
import type { SqlLike } from '../rows';
import { acceptInvitationAttach } from './onboarding-attach';

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
  opts: {
    readonly kind: 'staff' | 'customer';
    readonly isRoot: boolean;
    readonly isAccountOwner: boolean;
  },
): Promise<void> => {
  await tx`
    insert into public.accounts (id, display_name, email, kind, created_at)
    values (${membership.accountId}, ${membership.displayName},
      ${membership.email}, ${opts.kind}, ${membership.occurredAt})
  `;
  await tx`
    insert into public.memberships
      (id, user_id, account_id, is_root, is_account_owner, created_at)
    values (${membership.membershipId}, ${membership.userId},
      ${membership.accountId}, ${opts.isRoot}, ${opts.isAccountOwner},
      ${membership.occurredAt})
  `;
  // roles-only (ADR-0014 2.B′): the initial grant becomes a personal role.
  if (membership.permissions.length > 0) {
    await upsertPersonalRole(
      tx,
      {
        id: membership.membershipId,
        accountId: membership.accountId,
        roleIds: [],
      },
      membership.permissions,
    );
  }
};

// Creating an account makes you its owner (ADR-0011): own-scope bypass for the
// self-signup customer, plus the (stronger) root flag for the bootstrap owner.
const createOwnerMembership = (
  sql: Sql,
  membership: NewIdentityMembership,
  event: AccessOwnerBootstrapped,
): Promise<void> =>
  sql.begin(async (tx) => {
    await insertMembershipBundle(tx, membership, {
      kind: 'staff',
      isRoot: true,
      isAccountOwner: true,
    });
    await insertAuditEvent(tx, event);
  }) as Promise<void>;

// Birth is atomic (ADR-0016 Decision 2): account + owner membership +
// subscription (+ its billing event) commit in ONE transaction.
const createCustomerMembership = (
  sql: Sql,
  membership: NewIdentityMembership,
  subscription: Subscription,
  event: BillingSubscriptionStarted,
): Promise<void> =>
  sql.begin(async (tx) => {
    // maxOrganizationsOwned counts rows that DO NOT EXIST YET: two concurrent
    // creates by the same identity each count N and both insert — a phantom
    // that `select … for update` cannot lock (there is no row to lock). The
    // per-user advisory xact lock is the serialization point instead
    // (ADR-0016 Decision 4); it releases automatically at commit/rollback.
    await tx`select pg_advisory_xact_lock(hashtext(${membership.userId}))`;
    await insertMembershipBundle(tx, membership, {
      kind: 'customer',
      isRoot: false,
      isAccountOwner: true,
    });
    await insertSubscriptionRow(tx, subscription);
    await insertBillingEvent(tx, event);
  }) as Promise<void>;

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

  createOwnerMembership: (membership, event) =>
    createOwnerMembership(sql, membership, event),

  createCustomerMembership: (membership, subscription, event) =>
    createCustomerMembership(sql, membership, subscription, event),

  acceptInvitation: (membership, invitation, event) =>
    acceptInvitationAttach(sql, { membership, invitation, event }),

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
