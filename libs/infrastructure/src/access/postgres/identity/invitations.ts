import type { AccessInvitationStore } from '@acme/application';
import type {
  AccessPermission,
  AccountId,
  AccountKind,
  InvitationId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent } from '../rows';

/** Postgres invitations: create + the pending lookup the onboarding uses. */
export const createPostgresInvitationStore = (
  sql: Sql,
): AccessInvitationStore => ({
  createInvitation: async (invitation, event) => {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.invitations
          (id, account_id, email, permissions, invited_by, created_at,
           expires_at, token_hash)
        values (${invitation.invitationId}, ${invitation.accountId},
          ${invitation.email}, ${tx.json(invitation.permissions as never)},
          ${invitation.invitedBy}, ${invitation.createdAt},
          ${invitation.expiresAt}, ${invitation.tokenHash})
      `;
      await insertAuditEvent(tx, event);
    });
  },

  findPendingByTokenHash: async (tokenHash, now) => {
    const rows = await sql`
      select id, account_id, email
      from public.invitations
      where token_hash = ${tokenHash}
        and accepted_at is null
        and expires_at > ${now}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      invitationId: row['id'] as InvitationId,
      accountId: row['account_id'] as AccountId,
      email: row['email'] as string,
    };
  },

  consumeToken: async (invitationId) => {
    await sql`
      update public.invitations set token_hash = null where id = ${invitationId}
    `;
  },

  findPendingByEmail: async (email, now) => {
    const rows = await sql`
      select i.id, i.account_id, i.permissions, a.kind
      from public.invitations i
      join public.accounts a on a.id = i.account_id
      where lower(i.email) = lower(${email})
        and i.accepted_at is null
        and i.expires_at > ${now}
      order by i.created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      invitationId: row['id'] as InvitationId,
      accountId: row['account_id'] as AccountId,
      accountKind: row['kind'] as AccountKind,
      permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
    };
  },
});
