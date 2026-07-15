import type { MembershipId, UserId } from '../value-objects';
/**
 * An ORPHAN identity (no membership anywhere) was purged from the auth provider.
 * Irreversible, so it is audited with the email that existed at the time — the
 * identity itself is gone and cannot be looked up afterwards.
 *
 * NOTE: unlike the other sensitive writes, this one CANNOT be transactional —
 * the mutation lands in the auth provider, a different system from the audit
 * log. The event is appended after a confirmed delete, so it records what
 * actually happened rather than what was attempted.
 */
export type AccessIdentityDeleted = {
  readonly type: 'identity.deleted';
  readonly userId: UserId;
  readonly email: string | null;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};
