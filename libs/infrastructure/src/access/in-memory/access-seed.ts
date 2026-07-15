import type {
  AccessAuditRecord,
  CustomerAccountDetails,
} from '@acme/application';
import { createRole } from '@acme/domain';
import type {
  AccessGrant,
  AccessPermission,
  AccessSessionPolicies,
  AccountId,
  AccountStatus,
  InvitationId,
  Role,
  RoleId,
  RoleTemplate,
  SessionStatus,
} from '@acme/domain';

/**
 * Seed for the in-memory access store, shaped like the phase-4 tables:
 * accounts, memberships, sessions, grants and a customer directory. Ids are
 * raw strings (this is dev/test plumbing — the store brands them at its
 * boundary); relations are by id, and the actor is *derived* per read, so a
 * mutation (disable, revoke, grant) is visible on the very next request —
 * the revocation-immediacy guarantee the real adapters must also honour.
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

export const SEED_SESSION_CREATED_AT = '2026-01-01T00:00:00.000Z';

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
   * Identities that exist in the auth provider but hold no membership yet
   * (onboarding scenarios). Ignored by the in-memory store; the Postgres
   * seeder creates them in auth.users so FK constraints hold.
   */
  readonly users?: ReadonlyArray<{ readonly id: string }>;
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
  readonly accounts: Map<string, { status: AccountStatus; blocked: boolean }>;
  readonly blockedIdentities: Set<string>;
  readonly blockedMemberships: Set<string>;
  readonly memberships: Map<string, StoredMembership>;
  readonly sessions: Map<string, StoredSession>;
  readonly customers: Map<string, CustomerAccountDetails>;
  readonly grants: Map<string, AccessGrant>;
  /** Dynamic role bundles (ADR-0011), keyed by role id. */
  readonly roles: Map<string, Role>;
  /** Staff template overrides (ADR-0013/0014), keyed by template key. */
  readonly roleTemplates: Map<string, RoleTemplate>;
  readonly auditRecords: AccessAuditRecord[];
};

/**
 * Roles-only (ADR-0014): a seed membership's one-off `permissions` are stored as
 * a per-membership **personal role** (never a direct slot). Returns the personal
 * role to create for each membership that seeds non-empty permissions, keyed by
 * membership id so its `roleIds` can reference it.
 */
const seedPersonalRoles = (seed: InMemoryAccessSeed): Map<string, Role> => {
  const out = new Map<string, Role>();
  for (const m of seed.memberships ?? []) {
    if (m.permissions.length === 0) continue;
    const created = createRole({
      id: crypto.randomUUID() as RoleId,
      name: 'Personal permissions',
      accountId: m.accountId as AccountId,
      permissions: m.permissions,
      isPersonal: true,
    });
    if (created.ok) out.set(m.id, created.value);
  }
  return out;
};

export const toAccessStoreState = (
  seed: InMemoryAccessSeed,
): AccessStoreState => {
  const personal = seedPersonalRoles(seed);
  return {
    invitations: new Map(),
    settings: null,
    accounts: new Map(
      (seed.accounts ?? []).map((a) => [
        a.id,
        { status: a.status ?? 'active', blocked: a.blocked ?? false },
      ]),
    ),
    blockedIdentities: new Set(seed.blockedIdentities ?? []),
    blockedMemberships: new Set(seed.blockedMemberships ?? []),
    memberships: new Map(
      (seed.memberships ?? []).map((m) => {
        const own = personal.get(m.id);
        const roleIds = own
          ? [...(m.roleIds ?? []), own.id]
          : [...(m.roleIds ?? [])];
        return [
          m.id,
          {
            userId: m.userId,
            accountId: m.accountId,
            isRoot: m.isRoot ?? false,
            roleIds,
            isAccountOwner: m.isAccountOwner ?? false,
          },
        ];
      }),
    ),
    sessions: new Map(
      (seed.sessions ?? []).map((s) => [
        s.id,
        {
          membershipId: s.membershipId,
          status: s.status ?? 'active',
          expiresAt: s.expiresAt,
          createdAt: s.createdAt ?? SEED_SESSION_CREATED_AT,
          lastSeenAt: s.createdAt ?? SEED_SESSION_CREATED_AT,
          userAgent: null,
          createdIp: null,
          lastIp: null,
        },
      ]),
    ),
    customers: new Map(
      (seed.customers ?? []).map((c) => [
        c.accountId,
        {
          accountId: c.accountId as AccountId,
          displayName: c.displayName,
          email: c.email ?? null,
          status: c.status ?? 'active',
          createdAt: c.createdAt ?? '2026-01-01T00:00:00.000Z',
        },
      ]),
    ),
    grants: new Map((seed.grants ?? []).map((g) => [g.id, g])),
    roles: new Map([
      ...(seed.roles ?? []).map((r) => [r.id, r] as const),
      ...[...personal.values()].map((r) => [r.id, r] as const),
    ]),
    roleTemplates: new Map((seed.roleTemplates ?? []).map((t) => [t.key, t])),
    auditRecords: [],
  };
};
