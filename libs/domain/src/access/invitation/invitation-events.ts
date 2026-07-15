import type { AccessPermission } from '../permission';
import type {
  AccountId,
  InvitationId,
  MembershipId,
  RoleId,
  UserId,
} from '../value-objects';

/**
 * The invitation lifecycle as audit facts. Three distinct endings, deliberately
 * NOT collapsed into one "closed" event: accepted (a membership now exists),
 * revoked (staff withdrew it), and expiry — which is time-driven and therefore
 * needs no event at all, since it is derivable from `expiresAt`.
 */

/** An email was invited to join an EXISTING account with given permissions
 * and/or roles (ADR-0011); the membership inherits both on first login. */
export type AccessInvitationCreated = {
  readonly type: 'invitation.created';
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly roleIds: ReadonlyArray<RoleId>;
  readonly actorMembershipId: MembershipId;
  readonly expiresAt: string;
  readonly occurredAt: string;
};

/**
 * A pending invitation was withdrawn by staff before it was accepted. The row
 * stops being pending and its token stops activating. Never emitted for an
 * accepted invitation: a membership that already exists is removed, not revoked.
 */
export type AccessInvitationRevoked = {
  readonly type: 'invitation.revoked';
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** The invited email signed in: membership attached to the inviting account. */
export type AccessInvitationAccepted = {
  readonly type: 'invitation.accepted';
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly occurredAt: string;
};
