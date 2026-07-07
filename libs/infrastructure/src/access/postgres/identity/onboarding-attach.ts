import type {
  AcceptInvitationTarget,
  InvitationAttachOutcome,
  NewIdentityMembership,
} from '@acme/application';
import type { AccessInvitationAccepted } from '@acme/domain';
import type { Sql } from 'postgres';
import { upsertPersonalRole } from '../admin/personal-role';
import { insertAuditEvent } from '../rows';
import type { SqlLike } from '../rows';

/**
 * Attach-time seat check (ADR-0016 D1), inside the SAME transaction as the
 * attach. Locking the membership rows alone (the anti-orphan idiom) cannot
 * stop a concurrent INSERT — a row that does not exist yet has nothing to
 * lock (phantom) — so the ACCOUNT row is locked first: every attacher must
 * pass through it, and the membership count that follows (taken under lock)
 * sees the committed inserts of whoever held the lock before.
 */
const seatBlockedLocked = async (
  tx: SqlLike,
  accountId: string,
  seatLimit: number | null,
): Promise<boolean> => {
  await tx`
    select id from public.accounts where id = ${accountId} for update
  `;
  if (seatLimit === null) return false;
  const members = await tx`
    select id from public.memberships
    where account_id = ${accountId}
    for update
  `;
  return members.length >= seatLimit;
};

/**
 * Joins an EXISTING account: acceptance mark + membership + audit event in
 * one transaction — or, at the seat ceiling, NOTHING (`seat-blocked`): the
 * ADR-0016 bounce, which the application layer marks and surfaces.
 */
export const acceptInvitationAttach = async (
  sql: Sql,
  input: {
    readonly membership: NewIdentityMembership;
    readonly invitation: AcceptInvitationTarget;
    readonly event: AccessInvitationAccepted;
  },
): Promise<InvitationAttachOutcome> => {
  const { membership, invitation, event } = input;
  return sql.begin(async (tx) => {
    if (
      await seatBlockedLocked(tx, membership.accountId, invitation.seatLimit)
    ) {
      return 'seat-blocked';
    }
    await tx`
      update public.invitations
      set accepted_at = ${event.occurredAt}
      where id = ${invitation.invitationId}
    `;
    await tx`
      insert into public.memberships
        (id, user_id, account_id, role_ids, is_root, created_at)
      values (${membership.membershipId}, ${membership.userId},
        ${membership.accountId},
        ${(membership.roleIds ?? []) as unknown as string[]}::uuid[],
        false, ${membership.occurredAt})
    `;
    // roles-only (ADR-0014 2.B′): the invitation's direct grant becomes a
    // personal role, appended alongside any inherited shared roles.
    if (membership.permissions.length > 0) {
      await upsertPersonalRole(
        tx,
        {
          id: membership.membershipId,
          accountId: membership.accountId,
          roleIds: membership.roleIds ?? [],
        },
        membership.permissions,
      );
    }
    await insertAuditEvent(tx, event);
    return 'attached';
  }) as Promise<InvitationAttachOutcome>;
};
