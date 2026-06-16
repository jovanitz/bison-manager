import type { AccessMemberDirectory } from '@acme/application';
import type { AccountId, MembershipId, UserId } from '@acme/domain';
import { appendInMemoryAuditRecord } from '../in-memory-audit-trail';
import { accountKindOf, hasOtherAdmin } from './in-memory-admin-repository';
import type { AccessStoreState } from '../in-memory-access-seed';

/** Members of one account; removal deletes membership + sessions (cascade). */
export const makeInMemoryMemberDirectory = (
  state: AccessStoreState,
): AccessMemberDirectory => ({
  listMembers: async (accountId) =>
    [...state.memberships.entries()]
      .filter(([, m]) => m.accountId === accountId)
      .map(([id, m]) => ({
        membershipId: id as MembershipId,
        userId: m.userId as UserId,
        permissions: m.permissions,
        isRoot: m.isRoot,
        blocked: state.blockedMemberships.has(id),
      })),

  removeMember: async (membershipId, event, requireCoAdmin) => {
    if (
      requireCoAdmin &&
      !hasOtherAdmin(state, event.accountId, membershipId)
    ) {
      return { orphaned: true };
    }
    for (const [sessionId, session] of state.sessions) {
      if (session.membershipId === membershipId) {
        state.sessions.delete(sessionId);
      }
    }
    state.memberships.delete(membershipId);
    appendInMemoryAuditRecord(state, event);
    return { orphaned: false };
  },

  listMembershipsByUser: async (userId) =>
    [...state.memberships.entries()]
      .filter(([, m]) => m.userId === userId)
      .map(([id, m]) => ({
        membershipId: id as MembershipId,
        accountId: m.accountId as AccountId,
        accountKind: accountKindOf(state, m.accountId),
        accountStatus:
          state.accounts.get(m.accountId)?.status ?? ('active' as const),
        accountName: state.customers.get(m.accountId)?.displayName ?? null,
      })),

  switchSession: async (sessionId, toMembershipId, expiresAt, event) => {
    const session = state.sessions.get(sessionId);
    if (!session) return;
    state.sessions.set(sessionId, {
      ...session,
      membershipId: toMembershipId,
      expiresAt,
      lastSeenAt: event.occurredAt,
    });
    appendInMemoryAuditRecord(state, event);
  },
});
