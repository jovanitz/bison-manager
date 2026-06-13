import type {
  AccessInvitationCreated,
  AccessPermission,
  AccountId,
  AccountKind,
  InvitationId,
} from '@acme/domain';

/**
 * Invitations: the only way a user joins an EXISTING account. Created by
 * whoever holds `members.invite`; consumed automatically by the onboarding
 * flow when the invited email signs in for the first time (see the identity
 * use cases — acceptance is atomic with the membership creation).
 */
export type PendingAccessInvitation = {
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly accountKind: AccountKind;
  readonly permissions: ReadonlyArray<AccessPermission>;
};

export type AccessInvitationStore = {
  /** Persists invitation + `invitation.created` in one transaction. */
  readonly createInvitation: (
    invitation: {
      readonly invitationId: InvitationId;
      readonly accountId: AccountId;
      readonly email: string;
      readonly permissions: ReadonlyArray<AccessPermission>;
      readonly invitedBy: string;
      readonly createdAt: string;
      readonly expiresAt: string;
    },
    event: AccessInvitationCreated,
  ) => Promise<void>;
  /** Newest unexpired, unaccepted invitation for an email (case-insensitive). */
  readonly findPendingByEmail: (
    email: string,
    now: string,
  ) => Promise<PendingAccessInvitation | null>;
};
