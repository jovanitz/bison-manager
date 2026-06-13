import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditTrail,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  AccessInvitationStore,
  AccessMemberDirectory,
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
  CustomerDirectory,
  IdentityOnboardingRepository,
} from '@acme/application';
import type {
  AccessGrant,
  AccessAuditEvent,
  AccountId,
  MembershipId,
  UserId,
} from '@acme/domain';
import {
  appendInMemoryAuditRecord,
  makeInMemoryAuditTrail,
} from './in-memory-audit-trail';
import {
  makeInMemoryAdminRepository,
  makeInMemoryMemberDirectory,
} from './in-memory-admin-repository';
import { makeInMemoryIdentityOnboarding } from './in-memory-identity-onboarding';
import { makeInMemoryInvitationStore } from './in-memory-invitations';
import {
  makeInMemorySessionActivityRecorder,
  makeInMemorySessionPolicyStore,
} from './in-memory-session-policy';
import { toAccessStoreState } from './in-memory-access-seed';
import type {
  AccessStoreState,
  InMemoryAccessSeed,
} from './in-memory-access-seed';

/**
 * In-memory implementation of every access port — the reference the Postgres
 * adapters are contract-tested against. One factory, one shared state: writes
 * that pair a mutation with its audit event land together (synchronous =
 * atomic here; the real adapters use a transaction), and the actor is joined
 * fresh from accounts/memberships/sessions/grants on every read, so admin
 * mutations take effect on the next request.
 */
export type InMemoryAccessStore = {
  readonly actors: AccessActorReader;
  readonly grantExpiry: AccessGrantExpiryRecorder;
  readonly auditTrail: AccessAuditTrail;
  readonly admin: AccessAdminRepository;
  readonly grants: AccessGrantRepository;
  readonly customers: CustomerDirectory;
  readonly onboarding: IdentityOnboardingRepository;
  readonly sessionPolicies: AccessSessionPolicyStore;
  readonly sessionActivity: AccessSessionActivityRecorder;
  readonly invitations: AccessInvitationStore;
  readonly members: AccessMemberDirectory;
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
      accountKind: state.customers.has(membership.accountId)
        ? ('customer' as const)
        : ('staff' as const),
      session: {
        id: sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      permissions: membership.permissions,
      grants: [...state.grants.values()].filter(
        (grant) => grant.membershipId === session.membershipId,
      ),
    };
  },
});

const makeGrantRepository = (
  state: AccessStoreState,
): AccessGrantRepository => {
  const save = async (grant: AccessGrant, event: AccessAuditEvent) => {
    state.grants.set(grant.id, grant);
    appendInMemoryAuditRecord(state, event);
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
          appendInMemoryAuditRecord(state, entry.event);
        }
      },
    },
    auditTrail: makeInMemoryAuditTrail(state),
    admin: makeInMemoryAdminRepository(state),
    grants: makeGrantRepository(state),
    customers: makeCustomerDirectory(state),
    onboarding: makeInMemoryIdentityOnboarding(state),
    sessionPolicies: makeInMemorySessionPolicyStore(state),
    sessionActivity: makeInMemorySessionActivityRecorder(state),
    invitations: makeInMemoryInvitationStore(state),
    members: makeInMemoryMemberDirectory(state),
  };
};
