import type { Result, TaggedError } from '@acme/shared';
import type {
  AccessInvitationAccepted,
  AccessLoginSucceeded,
  AccessOwnerBootstrapped,
  AccessPermission,
  AccountId,
  AccountKind,
  BillingSubscriptionStarted,
  InvitationId,
  MembershipId,
  RoleId,
  SessionId,
  Subscription,
  UserId,
} from '@acme/domain';

/**
 * Verifies a bearer token and yields the identity facts it proves — nothing
 * more. The token NEVER carries authorization; permissions, grants and
 * statuses are loaded from persisted state afterwards (resolveRequestActor).
 * The Supabase adapter validates the JWT signature/expiry and extracts the
 * `sub` (user) and `session_id` claims.
 */
export type VerifiedIdentity = {
  readonly userId: string;
  readonly sessionId: string;
  readonly email: string | null;
};

export type AccessTokenVerifier = {
  readonly verifyAccessToken: (
    token: string,
  ) => Promise<
    Result<VerifiedIdentity, TaggedError<'app/invalid-access-token'>>
  >;
};

/**
 * Identity onboarding: links a verified identity to a membership and a
 * session row. Writes that pair a mutation with an audit event must persist
 * both in one transaction (same rule as every access port).
 */
export type IdentityMembershipSnapshot = {
  readonly membershipId: MembershipId;
  readonly accountId: AccountId;
  /** Drives the session policy (staff strict, customer lax) — never grants. */
  readonly accountKind: AccountKind;
};

export type NewIdentityMembership = {
  readonly membershipId: MembershipId;
  readonly accountId: AccountId;
  readonly userId: UserId;
  readonly email: string | null;
  readonly displayName: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** Roles to attach on creation (ADR-0011); only the invitation flow sets it. */
  readonly roleIds?: ReadonlyArray<RoleId>;
  readonly occurredAt: string;
};

/**
 * Request context captured at the session edge. You cannot backfill what you
 * never captured: this feeds the future "active sessions" UI and forensics.
 */
export type SessionContext = {
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
};

export type NewIdentitySession = {
  readonly sessionId: SessionId;
  readonly membershipId: MembershipId;
  /** Login instant — anchors the absolute session-lifetime clock. */
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly context: SessionContext;
};

export type ActiveIdentitySession = {
  readonly sessionId: SessionId;
  readonly lastSeenAt: string;
};

/**
 * Attach-time seat enforcement (ADR-0016 D1 — invitations never reserve
 * seats, so the limit holds HERE, transactionally): the resolved seat ceiling
 * travels with the accept and the adapter counts current members inside its
 * own transaction. `null` = unlimited (staff orgs, unlimited plans).
 */
export type AcceptInvitationTarget = {
  readonly invitationId: InvitationId;
  readonly seatLimit: number | null;
};

/** `seat-blocked` = the org is full; NOTHING was written (the bounce). */
export type InvitationAttachOutcome = 'attached' | 'seat-blocked';

export type IdentityOnboardingRepository = {
  readonly findMembershipByUser: (
    userId: UserId,
  ) => Promise<IdentityMembershipSnapshot | null>;
  readonly sessionExists: (sessionId: SessionId) => Promise<boolean>;
  /** “Can anyone administer permissions?” — the bootstrap-needed probe. */
  readonly rootAdminExists: () => Promise<boolean>;
  /** Creates a staff account + owner membership, atomically with the event. */
  readonly createOwnerMembership: (
    membership: NewIdentityMembership,
    event: AccessOwnerBootstrapped,
  ) => Promise<void>;
  /**
   * Creates a customer account + membership (self-signup default) AND the
   * org's subscription (+ its `subscription.started` billing event) in ONE
   * transaction — birth is atomic (ADR-0016 Decision 2): an org can never
   * exist without its subscription facts.
   */
  readonly createCustomerMembership: (
    membership: NewIdentityMembership,
    subscription: Subscription,
    event: BillingSubscriptionStarted,
  ) => Promise<void>;
  /**
   * Joins an EXISTING account (invitation flow): membership creation, the
   * invitation's acceptance mark and the audit event commit in one
   * transaction. No account row is created. When the account already sits at
   * `seatLimit` members (counted under lock, in-transaction) the attach is
   * refused: `seat-blocked`, nothing written — the ADR-0016 bounce.
   */
  readonly acceptInvitation: (
    membership: NewIdentityMembership,
    invitation: AcceptInvitationTarget,
    event: AccessInvitationAccepted,
  ) => Promise<InvitationAttachOutcome>;
  /** Registers the session row, atomically with its login event. */
  readonly createSession: (
    session: NewIdentitySession,
    event: AccessLoginSucceeded,
  ) => Promise<void>;
  /** Live sessions of a membership (for the concurrent-session cap). */
  readonly listActiveSessions: (
    membershipId: MembershipId,
    now: string,
  ) => Promise<ReadonlyArray<ActiveIdentitySession>>;
};
