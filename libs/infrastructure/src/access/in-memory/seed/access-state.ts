import type {
  AccessAuditRecord,
  CustomerAccountDetails,
} from '@acme/application';
import type {
  AccessGrant,
  AccessPermission,
  AccessSessionPolicies,
  AccountKind,
  AccountStatus,
  InvitationId,
  Role,
  RoleTemplate,
  SessionStatus,
} from '@acme/domain';

/**
 * The pure type surface of the in-memory access store: the seed shapes and the
 * store STATE. Kept in its own module so both `access-seed` (which builds and
 * consumes the state) and `seed-builders` (which constructs its maps) depend on
 * it without depending on each other.
 */
export type SeedAccount = {
  readonly id: string;
  readonly status?: AccountStatus;
  /** Soft-blocked org: members can sign in but cannot operate. */
  readonly blocked?: boolean;
};

export type SeedMembership = {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** The protected super-admin membership (the bootstrapped owner). */
  readonly isRoot?: boolean;
  /** Assigned role ids (ADR-0011); unioned into permissions at resolution. */
  readonly roleIds?: ReadonlyArray<string>;
  /** Account-owner bypass (ADR-0011); defaults false. */
  readonly isAccountOwner?: boolean;
};

export type SeedSession = {
  readonly id: string;
  readonly membershipId: string;
  readonly expiresAt: string;
  readonly status?: SessionStatus;
  /** Login instant (absolute-lifetime anchor). Defaults to a fixed past. */
  readonly createdAt?: string;
};


/**
 * Directory entries. Security invariant (see the impersonation use cases):
 * only customer accounts may appear here — a staff account in the directory
 * would become impersonable by support.
 */
export type SeedCustomer = {
  readonly accountId: string;
  readonly displayName: string;
  readonly email?: string | null;
  readonly status?: string;
  readonly createdAt?: string;
};

export type InMemoryAccessSeed = {
  readonly accounts?: ReadonlyArray<SeedAccount>;
  readonly memberships?: ReadonlyArray<SeedMembership>;
  readonly sessions?: ReadonlyArray<SeedSession>;
  readonly customers?: ReadonlyArray<SeedCustomer>;
  readonly grants?: ReadonlyArray<AccessGrant>;
  /** Dynamic roles (ADR-0011); memberships reference them by `roleIds`. */
  readonly roles?: ReadonlyArray<Role>;
  /** Staff overrides of the default-role templates (ADR-0013/0014). */
  readonly roleTemplates?: ReadonlyArray<RoleTemplate>;
  /**
   * Identities that exist in the auth provider. Those holding no membership are
   * the "orphans" the directory lists — in memory we now MATERIALIZE them (they
   * used to be ignored), so the orphan view and its purge behave like the real
   * cross-schema query (auth.users ⋈ memberships) instead of being empty.
   * The Postgres seeder creates them in auth.users so FK constraints hold.
   */
  readonly users?: ReadonlyArray<{
    readonly id: string;
    readonly email?: string | null;
    readonly createdAt?: string;
  }>;
  /** User ids soft-blocked at the identity level (all their orgs). */
  readonly blockedIdentities?: ReadonlyArray<string>;
  /** Membership ids soft-blocked at the membership level (one org only). */
  readonly blockedMemberships?: ReadonlyArray<string>;
};

export type StoredMembership = {
  readonly userId: string;
  readonly accountId: string;
  readonly isRoot: boolean;
  /**
   * Roles-only (ADR-0014): the membership's effective permissions are EXACTLY
   * `expand(roleIds)` — one-off grants live in a personal role here, there is no
   * direct permission slot.
   */
  readonly roleIds: ReadonlyArray<string>;
  /** Ownership bypass (ADR-0011): authorized within its own account. */
  readonly isAccountOwner: boolean;
};

export type StoredSession = {
  readonly membershipId: string;
  readonly status: SessionStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly userAgent: string | null;
  readonly createdIp: string | null;
  readonly lastIp: string | null;
};

export type StoredInvitation = {
  readonly invitationId: InvitationId;
  readonly accountId: string;
  readonly email: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly roleIds: ReadonlyArray<string>;
  readonly createdAt: string;
  expiresAt: string;
  readonly acceptedAt: string | null;
  /** SHA-256 of the one-time activation token; null once consumed. */
  tokenHash: string | null;
  /** When a login-time attach bounced off the seat limit (ADR-0016 D1). */
  seatBlockedAt: string | null;
  /** Withdrawn by staff before acceptance: stops being pending, token dies. */
  revokedAt: string | null;
};

export type AccessStoreState = {
  readonly invitations: Map<string, StoredInvitation>;
  /** Runtime-editable session policy; null = domain defaults (version 1). */
  settings: { policies: AccessSessionPolicies; version: number } | null;
  readonly accounts: Map<
    string,
    {
      status: AccountStatus;
      blocked: boolean;
      kind: AccountKind;
      pendingDeletionUntil: string | null;
    }
  >;
  readonly blockedIdentities: Set<string>;
  readonly blockedMemberships: Set<string>;
  readonly memberships: Map<string, StoredMembership>;
  readonly sessions: Map<string, StoredSession>;
  readonly customers: Map<string, CustomerAccountDetails>;
  /** Auth-provider identities; those with no membership surface as orphans. */
  readonly users: Map<
    string,
    { readonly id: string; readonly email: string | null; readonly createdAt: string }
  >;
  readonly grants: Map<string, AccessGrant>;
  /** Dynamic role bundles (ADR-0011), keyed by role id. */
  readonly roles: Map<string, Role>;
  /** Staff template overrides (ADR-0013/0014), keyed by template key. */
  readonly roleTemplates: Map<string, RoleTemplate>;
  readonly auditRecords: AccessAuditRecord[];
};
