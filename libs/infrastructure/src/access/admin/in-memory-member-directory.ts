import type { AccessMemberDirectory } from '@acme/application';
import type { AccountId, MembershipId, RoleId, UserId } from '@acme/domain';
import { appendInMemoryAuditRecord } from '../in-memory/audit-trail';
import {
  oneOffPermissions,
  removeWouldOrphan,
} from './in-memory-admin-repository';
import { accountKindOf } from '../in-memory/seed/access-seed';
import type { AccessStoreState } from '../in-memory/seed/access-seed';

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
        // the editable one-off set (direct ∪ personal role); shared roles are
        // listed separately via `roleIds`, which excludes the personal role.
        permissions: oneOffPermissions(state, m),
        roleIds: m.roleIds.filter(
          (rid) => !state.roles.get(rid)?.isPersonal,
        ) as unknown as ReadonlyArray<RoleId>,
        isRoot: m.isRoot,
        blocked: state.blockedMemberships.has(id),
      })),

  removeMember: async (membershipId, event, requireCoAdmin) => {
    if (requireCoAdmin && removeWouldOrphan(state, membershipId)) {
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
