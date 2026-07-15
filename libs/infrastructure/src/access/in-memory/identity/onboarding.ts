import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
  NewIdentitySession,
  SubscriptionStore,
} from '@acme/application';
import type {
  AccessPermission,
  AccountId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import { appendInMemoryAuditRecord } from '../audit-trail';
import { upsertPersonalRole } from '../../admin/in-memory-membership-perms';
import type { AccessStoreState } from '../access-seed';

/**
 * The billing seam of the onboarding (ADR-0016 Decision 2): org birth writes
 * the subscription + its `subscription.started` event through the SAME
 * in-memory billing state the billing stores read (synchronous = the Postgres
 * transaction). Wired by the composition root from
 * `createInMemorySubscriptionStore(billingState)`.
 */
export type InMemoryIdentityBillingSink = Pick<SubscriptionStore, 'save'>;

/**
 * In-memory onboarding, sharing the store state: provisioned memberships and
 * sessions are immediately visible to the actor reader, and customer accounts
 * surface in the directory (staff accounts never do).
 */

/**
 * Roles-only (ADR-0014): a freshly-provisioned membership's initial grant
 * becomes a personal role (there is no direct slot), so resolution finds it.
 */
const movePermsToPersonalRole = (
  state: AccessStoreState,
  membershipId: string,
  permissions: ReadonlyArray<AccessPermission>,
): void => {
  const m = state.memberships.get(membershipId);
  if (m && permissions.length > 0) {
    upsertPersonalRole(state, membershipId, m, permissions);
  }
};

const storeMembership = (
  state: AccessStoreState,
  membership: NewIdentityMembership,
  isRoot: boolean,
  isAccountOwner: boolean,
): void => {
  state.accounts.set(membership.accountId, {
    status: 'active',
    blocked: false,
  });
  state.memberships.set(membership.membershipId, {
    userId: membership.userId,
    accountId: membership.accountId,
    isRoot,
    roleIds: [],
    isAccountOwner,
  });
  movePermsToPersonalRole(
    state,
    membership.membershipId,
    membership.permissions,
  );
};

const storeSession = (
  state: AccessStoreState,
  session: NewIdentitySession,
): void => {
  state.sessions.set(session.sessionId, {
    membershipId: session.membershipId,
    status: 'active',
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    lastSeenAt: session.createdAt,
    userAgent: session.context.userAgent,
    createdIp: session.context.ipAddress,
    lastIp: session.context.ipAddress,
  });
};

const acceptInvitation: (
  state: AccessStoreState,
  ...args: Parameters<IdentityOnboardingRepository['acceptInvitation']>
) => ReturnType<IdentityOnboardingRepository['acceptInvitation']> = async (
  state,
  membership,
  { invitationId, seatLimit },
  event,
) => {
  // Attach-time seat check (ADR-0016 D1): at the ceiling nothing is
  // written — the bounce. Synchronous = the Postgres locked count.
  const members = [...state.memberships.values()].filter(
    (m) => m.accountId === membership.accountId,
  ).length;
  if (seatLimit !== null && members >= seatLimit) return 'seat-blocked';
  const invitation = state.invitations.get(invitationId);
  if (invitation) {
    state.invitations.set(invitationId, {
      ...invitation,
      acceptedAt: event.occurredAt,
    });
  }
  // join the EXISTING account: membership only, no account row. Roles come
  // from the invitation (ADR-0011); its one-off grant becomes a personal role.
  const { membershipId, permissions } = membership;
  state.memberships.set(membershipId, {
    userId: membership.userId,
    accountId: membership.accountId,
    isRoot: false,
    roleIds: membership.roleIds ?? [],
    isAccountOwner: false,
  });
  movePermsToPersonalRole(state, membershipId, permissions);
  appendInMemoryAuditRecord(state, event);
  return 'attached';
};

export const makeInMemoryIdentityOnboarding = (
  state: AccessStoreState,
  billing: InMemoryIdentityBillingSink,
): IdentityOnboardingRepository => ({
  findMembershipByUser: async (userId) => {
    for (const [id, membership] of state.memberships) {
      if (membership.userId === userId) {
        return {
          membershipId: id as MembershipId,
          accountId: membership.accountId as AccountId,
          accountKind: state.customers.has(membership.accountId)
            ? ('customer' as const)
            : ('staff' as const),
        };
      }
    }
    return null;
  },

  sessionExists: async (sessionId) => state.sessions.has(sessionId),

  rootAdminExists: async () =>
    [...state.memberships.values()].some((membership) => membership.isRoot),

  createOwnerMembership: async (membership, event) => {
    // The bootstrapped owner owns the account it is created in (ADR-0011);
    // root authority is the stronger flag, but ownership holds too.
    storeMembership(state, membership, true, true);
    appendInMemoryAuditRecord(state, event);
  },

  createCustomerMembership: async (membership, subscription, event) => {
    // Self-signup: the creator owns the org they just made (own-scope bypass).
    storeMembership(state, membership, false, true);
    state.customers.set(membership.accountId, {
      accountId: membership.accountId,
      displayName: membership.displayName,
      email: membership.email,
      status: 'active',
      createdAt: membership.occurredAt,
    });
    // Birth is atomic (ADR-0016): the subscription + its started event land
    // in the billing state in the same synchronous step.
    await billing.save(subscription, event);
  },

  acceptInvitation: (membership, invitation, event) =>
    acceptInvitation(state, membership, invitation, event),

  createSession: async (session, event) => {
    storeSession(state, session);
    appendInMemoryAuditRecord(state, event);
  },

  listActiveSessions: async (membershipId, now) =>
    [...state.sessions.entries()]
      .filter(
        ([, s]) =>
          s.membershipId === membershipId &&
          s.status === 'active' &&
          new Date(s.expiresAt).getTime() > new Date(now).getTime(),
      )
      .map(([id, s]) => ({
        sessionId: id as SessionId,
        lastSeenAt: s.lastSeenAt,
      })),
});
