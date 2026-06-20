import type { Result, TaggedError } from '@acme/shared';
import type {
  AccessInvitationAccepted,
  AccessLoginSucceeded,
  AccessOwnerBootstrapped,
  AccessPermission,
  AccountId,
  AccountKind,
  InvitationId,
  MembershipId,
  RoleId,
  SessionId,
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
  /** Creates a customer account + membership (self-signup default). */
  readonly createCustomerMembership: (
    membership: NewIdentityMembership,
  ) => Promise<void>;
  /**
   * Joins an EXISTING account (invitation flow): membership creation, the
   * invitation's acceptance mark and the audit event commit in one
   * transaction. No account row is created.
   */
  readonly acceptInvitation: (
    membership: NewIdentityMembership,
    invitationId: InvitationId,
    event: AccessInvitationAccepted,
  ) => Promise<void>;
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
