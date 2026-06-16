import type { Result, TaggedError } from '@acme/shared';
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

/** A pending invitation located by its one-time activation token (by hash). */
export type PendingInvitationByToken = {
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
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
      /** SHA-256 of the one-time activation token; the plaintext is never stored. */
      readonly tokenHash: string;
    },
    event: AccessInvitationCreated,
  ) => Promise<void>;
  /** Newest unexpired, unaccepted invitation for an email (case-insensitive). */
  readonly findPendingByEmail: (
    email: string,
    now: string,
  ) => Promise<PendingAccessInvitation | null>;
  /**
   * The unexpired, unconsumed invitation whose token hashes to this value.
   * The activation flow's only lookup — it never takes an email, so there is
   * nothing to enumerate: the secret token IS the proof of invitation.
   */
  readonly findPendingByTokenHash: (
    tokenHash: string,
    now: string,
  ) => Promise<PendingInvitationByToken | null>;
  /** Burns the one-time token (idempotent) so a link cannot be replayed. */
  readonly consumeToken: (invitationId: InvitationId) => Promise<void>;
};

/**
 * Issues and re-derives the one-time activation token. The plaintext is shown
 * to the inviter exactly once (it forms the activation link); only its hash is
 * persisted, so a leaked database never yields working links. Server-side: the
 * implementation uses a CSPRNG + a one-way hash.
 */
export type SecretTokenService = {
  readonly issue: () => { readonly token: string; readonly tokenHash: string };
  readonly hashOf: (token: string) => string;
};

/**
 * Creates the identity (email + password) in the auth provider during
 * activation — a privileged, server-only operation (admin credentials). Fails
 * closed with `identity-already-exists` when the email already has an identity,
 * so activation can never silently reset another person's password.
 */
export type IdentityProvisioner = {
  readonly createIdentity: (input: {
    readonly email: string;
    readonly password: string;
  }) => Promise<
    Result<
      { readonly userId: string },
      TaggedError<
        'app/identity-already-exists' | 'app/identity-provision-failed'
      >
    >
  >;
};
