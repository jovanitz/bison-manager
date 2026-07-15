import type { AccountId, AccountKind } from '@acme/domain';
import type { Role } from '@acme/domain';
import type { AccessStoreState, InMemoryAccessSeed } from './access-state';

/** Login instant stamped on seeded sessions when the seed omits one. */
export const SEED_SESSION_CREATED_AT = '2026-01-01T00:00:00.000Z';

/** What `seedPersonalRoles` yields: personal roles keyed by membership id. */
type PersonalRoleSeeds = ReadonlyMap<string, Role>;

/** Seed → state map builders, split out to keep `toAccessStoreState` small. */
const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

export const usersOf = (seed: InMemoryAccessSeed): AccessStoreState['users'] =>
  new Map(
    (seed.users ?? []).map((u) => [
      u.id,
      {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.createdAt ?? DEFAULT_CREATED_AT,
      },
    ]),
  );

export const membershipsOf = (
  seed: InMemoryAccessSeed,
  personal: PersonalRoleSeeds,
): AccessStoreState['memberships'] =>
  new Map(
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
  );

export const sessionsOf = (seed: InMemoryAccessSeed): AccessStoreState['sessions'] =>
  new Map(
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
  );

export const customersOf = (seed: InMemoryAccessSeed): AccessStoreState['customers'] =>
  new Map(
    (seed.customers ?? []).map((c) => [
      c.accountId,
      {
        accountId: c.accountId as AccountId,
        displayName: c.displayName,
        email: c.email ?? null,
        status: c.status ?? 'active',
        createdAt: c.createdAt ?? DEFAULT_CREATED_AT,
      },
    ]),
  );


/** The canonical kind read: the explicit `kind` on the account (staff if unknown). */
export const accountKindOf = (
  state: AccessStoreState,
  accountId: string,
): AccountKind => state.accounts.get(accountId)?.kind ?? 'staff';

export const isCustomerAccount = (
  state: AccessStoreState,
  accountId: string,
): boolean => accountKindOf(state, accountId) === 'customer';

/**
 * Accounts, with an EXPLICIT kind (customer|staff) — the source of truth for the
 * customer/staff split, so promote/demote just flip this flag and the directory
 * filters on it. An account seeded as a customer is 'customer'; anything else
 * (the bootstrap owner, seeded staff) is 'staff'.
 */
export const accountsOf = (seed: InMemoryAccessSeed): AccessStoreState['accounts'] => {
  const customerIds = new Set((seed.customers ?? []).map((c) => c.accountId));
  return new Map(
    (seed.accounts ?? []).map((a) => [
      a.id,
      {
        status: a.status ?? 'active',
        blocked: a.blocked ?? false,
        kind: customerIds.has(a.id) ? ('customer' as const) : ('staff' as const),
        pendingDeletionUntil: null,
      },
    ]),
  );
};
