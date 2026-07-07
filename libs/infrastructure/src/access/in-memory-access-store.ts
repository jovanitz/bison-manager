import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditTrail,
  AccessBlockStore,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  AccessInvitationStore,
  AccessMemberDirectory,
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
  CustomerDirectory,
  IdentityOnboardingRepository,
  RoleStore,
  RoleTemplateStore,
  StaffDirectory,
} from '@acme/application';
import { resolveActorPermissions } from '@acme/application';
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
import { makeInMemoryAdminRepository } from './admin/in-memory-admin-repository';
import { makeInMemoryMemberDirectory } from './admin/in-memory-member-directory';
import { makeInMemoryBlockStore } from './in-memory-block-store';
import { createInMemoryRoleStore } from './role/in-memory-role-store';
import { createInMemoryRoleTemplateStore } from './role/in-memory-role-template-store';
import { makeInMemoryIdentityOnboarding } from './in-memory-identity-onboarding';
import type { InMemoryIdentityBillingSink } from './in-memory-identity-onboarding';
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
  readonly staffDirectory: StaffDirectory;
  readonly onboarding: IdentityOnboardingRepository;
  readonly sessionPolicies: AccessSessionPolicyStore;
  readonly sessionActivity: AccessSessionActivityRecorder;
  readonly invitations: AccessInvitationStore;
  readonly members: AccessMemberDirectory;
  readonly blocks: AccessBlockStore;
  readonly roles: RoleStore;
  readonly roleTemplates: RoleTemplateStore;
};

const makeActorReader = (state: AccessStoreState): AccessActorReader => ({
  findActorBySession: async (sessionId) => {
    const session = state.sessions.get(sessionId);
    const membership = session && state.memberships.get(session.membershipId);
    const account = membership && state.accounts.get(membership.accountId);
    if (!session || !membership || !account) return null;
    const roles = membership.roleIds.flatMap((id) => {
      const role = state.roles.get(id);
      return role ? [role] : [];
    });
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
      isRoot: membership.isRoot,
      isAccountOwner: membership.isAccountOwner,
      blocked:
        (account.blocked ?? false) ||
        state.blockedIdentities.has(membership.userId) ||
        state.blockedMemberships.has(session.membershipId),
      session: {
        id: sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      permissions: resolveActorPermissions(roles),
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
  /**
   * Where org birth writes the subscription + `subscription.started` event
   * (ADR-0016 Decision 2). Pass `createInMemorySubscriptionStore` over the
   * SAME billing state the billing stores are built on, so the birth facts
   * are immediately readable by guards and `billing.summary`.
   */
  billing: InMemoryIdentityBillingSink,
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
    // Staff = every account that is NOT in the customer directory. In-memory
    // accounts carry no name/email columns, so both surface as null here; the
    // Postgres adapter reads the real values.
    staffDirectory: {
      listStaff: async () =>
        [...state.accounts.keys()]
          .filter((id) => !state.customers.has(id))
          .map((id) => ({
            accountId: id as AccountId,
            email: null,
            displayName: null,
          })),
      // No auth layer in memory, so nothing can be orphaned from it.
      listOrphanIdentities: async () => [],
    },
    onboarding: makeInMemoryIdentityOnboarding(state, billing),
    sessionPolicies: makeInMemorySessionPolicyStore(state),
    sessionActivity: makeInMemorySessionActivityRecorder(state),
    invitations: makeInMemoryInvitationStore(state),
    members: makeInMemoryMemberDirectory(state),
    blocks: makeInMemoryBlockStore(state),
    roles: createInMemoryRoleStore(state),
    roleTemplates: createInMemoryRoleTemplateStore(state),
  };
};
