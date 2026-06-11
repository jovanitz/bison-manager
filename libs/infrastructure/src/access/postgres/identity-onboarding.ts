import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from '@acme/application';
import type { AccountId, MembershipId } from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from './rows';
import type { SqlLike } from './rows';

/**
 * Postgres onboarding. Provisioning writes (account + membership [+ event])
 * and session registration (+ login event) each run in one transaction.
 * auth.users rows are GoTrue's: a real sign-in guarantees they exist before
 * this code runs, so nothing here writes to the auth schema.
 */
const ROOT_ADMIN_MARKER = [{ action: 'permissions.update', scope: 'any' }];

const insertMembershipBundle = async (
  tx: SqlLike,
  membership: NewIdentityMembership,
  kind: 'staff' | 'customer',
): Promise<void> => {
  await tx`
    insert into public.accounts (id, display_name, email, kind, created_at)
    values (${membership.accountId}, ${membership.displayName},
      ${membership.email}, ${kind}, ${membership.occurredAt})
  `;
  await tx`
    insert into public.memberships (id, user_id, account_id, permissions, created_at)
    values (${membership.membershipId}, ${membership.userId},
      ${membership.accountId}, ${tx.json(membership.permissions as never)},
      ${membership.occurredAt})
  `;
};

export const createPostgresIdentityOnboarding = (
  sql: Sql,
): IdentityOnboardingRepository => ({
  findMembershipByUser: async (userId) => {
    if (!isUuid(userId)) return null;
    const rows = await sql`
      select id, account_id from public.memberships
      where user_id = ${userId}
      order by created_at asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membershipId: row['id'] as MembershipId,
      accountId: row['account_id'] as AccountId,
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
    // sql.json: a plain string param would arrive as a jsonb *scalar* and
    // containment would never match.
    const rows = await sql`
      select 1 from public.memberships
      where permissions @> ${sql.json(ROOT_ADMIN_MARKER as never)}
      limit 1
    `;
    return rows.length > 0;
  },

  createOwnerMembership: async (membership, event) => {
    await sql.begin(async (tx) => {
      await insertMembershipBundle(tx, membership, 'staff');
      await insertAuditEvent(tx, event);
    });
  },

  createCustomerMembership: async (membership) => {
    await sql.begin(async (tx) => {
      await insertMembershipBundle(tx, membership, 'customer');
    });
  },

  createSession: async (session, event) => {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.sessions (id, membership_id, expires_at)
        values (${session.sessionId}, ${session.membershipId}, ${session.expiresAt})
      `;
      await insertAuditEvent(tx, event);
    });
  },
});
