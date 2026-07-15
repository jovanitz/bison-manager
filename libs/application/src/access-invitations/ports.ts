import type { Result, TaggedError } from '@acme/shared';
import type {
  AccessInvitationCreated,
  AccessInvitationRevoked,
  AccessPermission,
  AccountId,
  AccountKind,
  InvitationId,
  RoleId,
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
  /** Roles to assign to the membership on acceptance (ADR-0011). */
  readonly roleIds: ReadonlyArray<RoleId>;
  /**
   * When a login-time attach bounced off the seat limit (ADR-0016 D1). A
   * marked invitation stays pending, but never silently auto-attaches on a
   * later login once the user holds any other membership; a still org-less
   * user may retry (and attach once a seat frees).
   */
  readonly seatBlockedAt: string | null;
};

/** A pending invitation located by its one-time activation token (by hash). */
export type PendingInvitationByToken = {
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
};

/**
 * A pending (unexpired, unaccepted) invitation as the admin dashboard lists it.
 * Never carries the token — the plaintext is shown once at creation and only its
 * hash is stored. To get a fresh link, regenerate it.
 */
export type PendingInvitationSummary = {
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Set when the attach bounced off the seat limit — admin visibility (ADR-0016). */
  readonly seatBlockedAt: string | null;
};

export type AccessInvitationStore = {
  /** Persists invitation + `invitation.created` in one transaction. */
  readonly createInvitation: (
    invitation: {
      readonly invitationId: InvitationId;
      readonly accountId: AccountId;
      readonly email: string;
      readonly permissions: ReadonlyArray<AccessPermission>;
      readonly roleIds: ReadonlyArray<RoleId>;
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
  /**
   * Marks a pending invitation as seat-blocked (the attach bounced: org
   * full). First bounce wins — the timestamp is written once; the invitation
   * stays pending and visibly marked for the inviting admin (ADR-0016 D1).
   */
  readonly markSeatBlocked: (
    invitationId: InvitationId,
    occurredAt: string,
  ) => Promise<void>;
  /** Every unexpired, unaccepted, unrevoked invitation — the dashboard's list. */
  readonly listPending: (
    now: string,
  ) => Promise<ReadonlyArray<PendingInvitationSummary>>;
  /** The still-pending invitation with this id — the revoke flow's lookup. */
  readonly findPendingById: (
    invitationId: InvitationId,
    now: string,
  ) => Promise<PendingInvitationSummary | null>;
  /**
   * Withdraws a pending invitation: marks it revoked AND appends
   * `invitation.revoked` in ONE transaction, so an unaudited revoke is
   * unrepresentable. Its token stops activating. Returns false when nothing
   * pending matched (unknown / already accepted / already revoked).
   */
  readonly revokeInvitation: (
    invitationId: InvitationId,
    event: AccessInvitationRevoked,
  ) => Promise<boolean>;
  /**
   * Rotate a pending invitation's token (new hash + expiry), so the inviter can
   * re-issue a fresh link. Returns false if no pending invitation matched.
   */
  readonly regenerateToken: (
    invitationId: InvitationId,
    next: { readonly tokenHash: string; readonly expiresAt: string },
    now: string,
  ) => Promise<boolean>;
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
