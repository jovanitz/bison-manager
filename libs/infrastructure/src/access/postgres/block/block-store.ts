import type { AccessBlockStore } from '@acme/application';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from '../rows';

/**
 * Postgres soft-block store. Org block flips `accounts.blocked`; identity block
 * is a row in `blocked_identities`. Each write commits the state change with
 * its audit event in one transaction. The actor reader ORs both into the
 * resolved actor's `blocked`, so the policy denies operations immediately.
 */
export const createPostgresBlockStore = (sql: Sql): AccessBlockStore => ({
  isOrgBlocked: async (accountId) => {
    if (!isUuid(accountId)) return false;
    const rows = await sql`
      select blocked from public.accounts where id = ${accountId}
    `;
    return (rows[0]?.['blocked'] as boolean | undefined) ?? false;
  },

  setOrgBlocked: async (accountId, blocked, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.accounts set blocked = ${blocked} where id = ${accountId}
      `;
      await insertAuditEvent(tx, event);
    });
  },

  isIdentityBlocked: async (userId) => {
    if (!isUuid(userId)) return false;
    const rows = await sql`
      select 1 from public.blocked_identities where user_id = ${userId}
    `;
    return rows.length > 0;
  },

  setIdentityBlocked: async (userId, blocked, event) => {
    await sql.begin(async (tx) => {
      if (blocked) {
        const reason = event.type === 'access.blocked' ? event.reason : null;
        await tx`
          insert into public.blocked_identities (user_id, reason)
          values (${userId}, ${reason})
          on conflict (user_id) do nothing
        `;
      } else {
        await tx`
          delete from public.blocked_identities where user_id = ${userId}
        `;
      }
      await insertAuditEvent(tx, event);
    });
  },

  isIdentityRoot: async (userId) => {
    if (!isUuid(userId)) return false;
    const rows = await sql`
      select 1 from public.memberships
      where user_id = ${userId} and is_root limit 1
    `;
    return rows.length > 0;
  },

  isMembershipBlocked: async (membershipId) => {
    if (!isUuid(membershipId)) return false;
    const rows = await sql`
      select blocked from public.memberships where id = ${membershipId}
    `;
    return (rows[0]?.['blocked'] as boolean | undefined) ?? false;
  },

  setMembershipBlocked: async (membershipId, blocked, event) => {
    await sql.begin(async (tx) => {
      await tx`
        update public.memberships set blocked = ${blocked}
        where id = ${membershipId}
      `;
      await insertAuditEvent(tx, event);
    });
  },
});
