import { createRole } from '@acme/domain';
import type { AccountId, Role, RoleId } from '@acme/domain';

/**
 * Seed for the in-memory access store, shaped like the phase-4 tables:
 * accounts, memberships, sessions, grants and a customer directory. Ids are
 * raw strings (this is dev/test plumbing — the store brands them at its
 * boundary); relations are by id, and the actor is *derived* per read, so a
 * mutation (disable, revoke, grant) is visible on the very next request —
 * the revocation-immediacy guarantee the real adapters must also honour.
 */
export type {
  AccessStoreState,
  InMemoryAccessSeed,
  SeedAccount,
  SeedCustomer,
  SeedMembership,
  SeedSession,
  StoredInvitation,
  StoredMembership,
  StoredSession,
} from './access-state';
import type { AccessStoreState, InMemoryAccessSeed } from './access-state';

/**
 * Roles-only (ADR-0014): a seed membership's one-off `permissions` are stored as
 * a per-membership **personal role** (never a direct slot). Returns the personal
 * role to create for each membership that seeds non-empty permissions, keyed by
 * membership id so its `roleIds` can reference it.
 */
export const seedPersonalRoles = (seed: InMemoryAccessSeed): Map<string, Role> => {
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

import {
  accountsOf,
  customersOf,
  membershipsOf,
  sessionsOf,
  usersOf,
} from './seed-builders';

export {
  accountKindOf,
  isCustomerAccount,
  SEED_SESSION_CREATED_AT,
} from './seed-builders';



export const toAccessStoreState = (
  seed: InMemoryAccessSeed,
): AccessStoreState => {
  const personal = seedPersonalRoles(seed);
  return {
    invitations: new Map(),
    settings: null,
    accounts: accountsOf(seed),
    users: usersOf(seed),
    blockedIdentities: new Set(seed.blockedIdentities ?? []),
    blockedMemberships: new Set(seed.blockedMemberships ?? []),
    memberships: membershipsOf(seed, personal),
    sessions: sessionsOf(seed),
    customers: customersOf(seed),
    grants: new Map((seed.grants ?? []).map((g) => [g.id, g])),
    roles: new Map([
      ...(seed.roles ?? []).map((r) => [r.id, r] as const),
      ...[...personal.values()].map((r) => [r.id, r] as const),
    ]),
    roleTemplates: new Map((seed.roleTemplates ?? []).map((t) => [t.key, t])),
    auditRecords: [],
  };
};
