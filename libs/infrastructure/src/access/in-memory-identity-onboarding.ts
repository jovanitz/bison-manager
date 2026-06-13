import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
  NewIdentitySession,
} from '@acme/application';
import type { AccountId, MembershipId, SessionId } from '@acme/domain';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

/**
 * In-memory onboarding, sharing the store state: provisioned memberships and
 * sessions are immediately visible to the actor reader, and customer accounts
 * surface in the directory (staff accounts never do).
 */
const storeMembership = (
  state: AccessStoreState,
  membership: NewIdentityMembership,
): void => {
  state.accounts.set(membership.accountId, { status: 'active' });
  state.memberships.set(membership.membershipId, {
    userId: membership.userId,
    accountId: membership.accountId,
    permissions: membership.permissions,
  });
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

export const makeInMemoryIdentityOnboarding = (
  state: AccessStoreState,
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
    [...state.memberships.values()].some((membership) =>
      membership.permissions.some(
        (p) => p.action === 'permissions.update' && p.scope === 'any',
      ),
    ),

  createOwnerMembership: async (membership, event) => {
    storeMembership(state, membership);
    appendInMemoryAuditRecord(state, event);
  },

  createCustomerMembership: async (membership) => {
    storeMembership(state, membership);
    state.customers.set(membership.accountId, {
      accountId: membership.accountId,
      displayName: membership.displayName,
      email: membership.email,
      status: 'active',
      createdAt: membership.occurredAt,
    });
  },

  acceptInvitation: async (membership, invitationId, event) => {
    const invitation = state.invitations.get(invitationId);
    if (invitation) {
      state.invitations.set(invitationId, {
        ...invitation,
        acceptedAt: event.occurredAt,
      });
    }
    // join the EXISTING account: membership only, no account row
    state.memberships.set(membership.membershipId, {
      userId: membership.userId,
      accountId: membership.accountId,
      permissions: membership.permissions,
    });
    appendInMemoryAuditRecord(state, event);
  },

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
