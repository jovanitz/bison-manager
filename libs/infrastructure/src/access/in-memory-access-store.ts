import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditFilter,
  AccessAuditRecord,
  AccessAuditTrail,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  CustomerDirectory,
} from '@acme/application';
import type {
  AccessAuditEvent,
  AccessGrant,
  AccountId,
  MembershipId,
  UserId,
} from '@acme/domain';
import { toAccessStoreState } from './in-memory-access-seed';
import type {
  AccessStoreState,
  InMemoryAccessSeed,
} from './in-memory-access-seed';

/**
 * In-memory implementation of every access port — the real store until the
 * Supabase adapters arrive in phase 4. One factory, one shared state: writes
 * that pair a mutation with its audit event land together (synchronous =
 * atomic here; the real adapters must use a transaction), and the actor is
 * joined fresh from accounts/memberships/sessions/grants on every read, so
 * admin mutations take effect on the next request.
 */
export type InMemoryAccessStore = {
  readonly actors: AccessActorReader;
  readonly grantExpiry: AccessGrantExpiryRecorder;
  readonly auditTrail: AccessAuditTrail;
  readonly admin: AccessAdminRepository;
  readonly grants: AccessGrantRepository;
  readonly customers: CustomerDirectory;
};

const appendRecord = (
  state: AccessStoreState,
  event: AccessAuditEvent,
): void => {
  state.auditRecords.push({
    id: `audit-${state.auditRecords.length + 1}`,
    event,
  });
};

const makeActorReader = (state: AccessStoreState): AccessActorReader => ({
  findActorBySession: async (sessionId) => {
    const session = state.sessions.get(sessionId);
    const membership = session && state.memberships.get(session.membershipId);
    const account = membership && state.accounts.get(membership.accountId);
    if (!session || !membership || !account) return null;
    return {
      membership: {
        id: session.membershipId as MembershipId,
        userId: membership.userId as UserId,
        accountId: membership.accountId as AccountId,
      },
      accountStatus: account.status,
      session: {
        id: sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
      },
      permissions: membership.permissions,
      grants: [...state.grants.values()].filter(
        (grant) => grant.membershipId === session.membershipId,
      ),
    };
  },
});

const makeAdminRepository = (
  state: AccessStoreState,
): AccessAdminRepository => ({
  findAccount: async (id) => {
    const account = state.accounts.get(id);
    return account ? { id, status: account.status } : null;
  },
  disableAccount: async (id, event) => {
    state.accounts.set(id, { status: 'disabled' });
    appendRecord(state, event);
  },
  findMembership: async (id) => {
    const membership = state.memberships.get(id);
    if (!membership) return null;
    return {
      id,
      accountId: membership.accountId as AccountId,
      permissions: membership.permissions,
    };
  },
  updatePermissions: async (id, permissions, event) => {
    const membership = state.memberships.get(id);
    if (!membership) return;
    state.memberships.set(id, { ...membership, permissions });
    appendRecord(state, event);
  },
  findSession: async (id) => {
    const session = state.sessions.get(id);
    const membership = session && state.memberships.get(session.membershipId);
    if (!session || !membership) return null;
    return {
      id,
      accountId: membership.accountId as AccountId,
      status: session.status,
    };
  },
  revokeSession: async (id, event) => {
    const session = state.sessions.get(id);
    if (!session) return;
    state.sessions.set(id, { ...session, status: 'revoked' });
    appendRecord(state, event);
  },
});

const makeGrantRepository = (
  state: AccessStoreState,
): AccessGrantRepository => {
  const save = async (grant: AccessGrant, event: AccessAuditEvent) => {
    state.grants.set(grant.id, grant);
    appendRecord(state, event);
  };
  return {
    findById: async (id) => state.grants.get(id) ?? null,
    saveNew: save,
    saveEnded: save,
  };
};

const makeCustomerDirectory = (state: AccessStoreState): CustomerDirectory => ({
  search: async (query) => {
    const needle = query.toLowerCase();
    return [...state.customers.values()]
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(needle) ||
          (c.email ?? '').toLowerCase().includes(needle),
      )
      .map(({ accountId, displayName, email }) => ({
        accountId,
        displayName,
        email,
      }));
  },
  read: async (accountId) => state.customers.get(accountId) ?? null,
});

const eventAccountId = (event: AccessAuditEvent): string | null => {
  if ('accountId' in event) return event.accountId;
  if ('targetAccountId' in event) return event.targetAccountId;
  return null;
};

const matchesFilter = (
  record: AccessAuditRecord,
  filter?: AccessAuditFilter,
): boolean => {
  if (!filter) return true;
  if (filter.types && !filter.types.includes(record.event.type)) return false;
  if (filter.accountId && eventAccountId(record.event) !== filter.accountId) {
    return false;
  }
  return true;
};

const makeAuditTrail = (state: AccessStoreState): AccessAuditTrail => ({
  append: async (event) => {
    appendRecord(state, event);
  },
  list: async (filter) => {
    const matching = state.auditRecords.filter((r) => matchesFilter(r, filter));
    return filter?.limit === undefined
      ? matching
      : matching.slice(0, filter.limit);
  },
});

export const createInMemoryAccessStore = (
  seed: InMemoryAccessSeed,
): InMemoryAccessStore => {
  const state = toAccessStoreState(seed);
  return {
    actors: makeActorReader(state),
    grantExpiry: {
      recordExpiry: async (entries) => {
        for (const entry of entries) {
          state.grants.set(entry.grant.id, entry.grant);
          appendRecord(state, entry.event);
        }
      },
    },
    auditTrail: makeAuditTrail(state),
    admin: makeAdminRepository(state),
    grants: makeGrantRepository(state),
    customers: makeCustomerDirectory(state),
  };
};
