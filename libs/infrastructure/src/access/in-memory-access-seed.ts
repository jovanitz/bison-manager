import type {
  AccessAuditRecord,
  CustomerAccountDetails,
} from '@acme/application';
import type {
  AccessGrant,
  AccessPermission,
  AccessSessionPolicies,
  AccountId,
  AccountStatus,
  InvitationId,
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
};

export type SeedMembership = {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
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
  /**
   * Identities that exist in the auth provider but hold no membership yet
   * (onboarding scenarios). Ignored by the in-memory store; the Postgres
   * seeder creates them in auth.users so FK constraints hold.
   */
  readonly users?: ReadonlyArray<{ readonly id: string }>;
};

export type StoredMembership = {
  readonly userId: string;
  readonly accountId: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
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
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
};

export type AccessStoreState = {
  readonly invitations: Map<string, StoredInvitation>;
  /** Runtime-editable session policy; null = domain defaults (version 1). */
  settings: { policies: AccessSessionPolicies; version: number } | null;
  readonly accounts: Map<string, { status: AccountStatus }>;
  readonly memberships: Map<string, StoredMembership>;
  readonly sessions: Map<string, StoredSession>;
  readonly customers: Map<string, CustomerAccountDetails>;
  readonly grants: Map<string, AccessGrant>;
  readonly auditRecords: AccessAuditRecord[];
};

export const toAccessStoreState = (
  seed: InMemoryAccessSeed,
): AccessStoreState => ({
  invitations: new Map(),
  settings: null,
  accounts: new Map(
    (seed.accounts ?? []).map((a) => [a.id, { status: a.status ?? 'active' }]),
  ),
  memberships: new Map(
    (seed.memberships ?? []).map((m) => [
      m.id,
      { userId: m.userId, accountId: m.accountId, permissions: m.permissions },
    ]),
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
  auditRecords: [],
});
