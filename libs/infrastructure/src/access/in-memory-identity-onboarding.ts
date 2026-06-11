import type { IdentityOnboardingRepository } from '@acme/application';
import type { AccountId, MembershipId } from '@acme/domain';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

/**
 * In-memory onboarding, sharing the store state: provisioned memberships and
 * sessions are immediately visible to the actor reader, and customer accounts
 * surface in the directory (staff accounts never do).
 */
export const makeInMemoryIdentityOnboarding = (
  state: AccessStoreState,
): IdentityOnboardingRepository => ({
  findMembershipByUser: async (userId) => {
    for (const [id, membership] of state.memberships) {
      if (membership.userId === userId) {
        return {
          membershipId: id as MembershipId,
          accountId: membership.accountId as AccountId,
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
    state.accounts.set(membership.accountId, { status: 'active' });
    state.memberships.set(membership.membershipId, {
      userId: membership.userId,
      accountId: membership.accountId,
      permissions: membership.permissions,
    });
    appendInMemoryAuditRecord(state, event);
  },

  createCustomerMembership: async (membership) => {
    state.accounts.set(membership.accountId, { status: 'active' });
    state.customers.set(membership.accountId, {
      accountId: membership.accountId,
      displayName: membership.displayName,
      email: membership.email,
      status: 'active',
      createdAt: membership.occurredAt,
    });
    state.memberships.set(membership.membershipId, {
      userId: membership.userId,
      accountId: membership.accountId,
      permissions: membership.permissions,
    });
  },

  createSession: async (session, event) => {
    state.sessions.set(session.sessionId, {
      membershipId: session.membershipId,
      status: 'active',
      expiresAt: session.expiresAt,
    });
    appendInMemoryAuditRecord(state, event);
  },
});
