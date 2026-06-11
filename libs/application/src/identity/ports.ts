import type { Result, TaggedError } from '@acme/shared';
import type {
  AccessLoginSucceeded,
  AccessOwnerBootstrapped,
  AccessPermission,
  AccountId,
  MembershipId,
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
};

export type NewIdentityMembership = {
  readonly membershipId: MembershipId;
  readonly accountId: AccountId;
  readonly userId: UserId;
  readonly email: string | null;
  readonly displayName: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly occurredAt: string;
};

export type NewIdentitySession = {
  readonly sessionId: SessionId;
  readonly membershipId: MembershipId;
  readonly expiresAt: string;
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
  /** Registers the session row, atomically with its login event. */
  readonly createSession: (
    session: NewIdentitySession,
    event: AccessLoginSucceeded,
  ) => Promise<void>;
};
