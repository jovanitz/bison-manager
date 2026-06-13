import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  AdminSessionDetail,
} from '@acme/application';
import { accessSessionExpiryFrom } from '@acme/domain';
import type {
  AccessAccountPromoted,
  AccessSessionPolicy,
  AccountId,
  MembershipId,
  SessionId,
  UserId,
} from '@acme/domain';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

const accountKindOf = (state: AccessStoreState, accountId: string) =>
  state.customers.has(accountId) ? ('customer' as const) : ('staff' as const);

/** Is there an administrator (permissions.update holder) of the account other
 * than `exceptId`? Anchors the anti-orphan invariant. */
const hasOtherAdmin = (
  state: AccessStoreState,
  accountId: string,
  exceptId: string,
): boolean =>
  [...state.memberships].some(
    ([id, m]) =>
      id !== exceptId &&
      m.accountId === accountId &&
      m.permissions.some((p) => p.action === 'permissions.update'),
  );

const promoteAccountToStaff = (
  state: AccessStoreState,
  id: AccountId,
  event: AccessAccountPromoted,
  staffPolicy: AccessSessionPolicy,
): void => {
  state.customers.delete(id);
  for (const [sessionId, session] of state.sessions) {
    const membership = state.memberships.get(session.membershipId);
    if (membership?.accountId !== id || session.status !== 'active') continue;
    const bounded = accessSessionExpiryFrom(
      staffPolicy,
      session.createdAt,
      session.lastSeenAt,
    );
    if (new Date(bounded).getTime() < new Date(session.expiresAt).getTime()) {
      state.sessions.set(sessionId, { ...session, expiresAt: bounded });
    }
  }
  appendInMemoryAuditRecord(state, event);
};

const listSessions = (
  state: AccessStoreState,
  membershipId: string,
): ReadonlyArray<AdminSessionDetail> =>
  [...state.sessions.entries()]
    .filter(([, s]) => s.membershipId === membershipId)
    .map(([id, s]) => ({
      id: id as SessionId,
      status: s.status,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      userAgent: s.userAgent,
      createdIp: s.createdIp,
      lastIp: s.lastIp,
    }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

const revokeActiveSessions = (
  state: AccessStoreState,
  membershipId: string,
  template: { actorMembershipId: string; occurredAt: string },
): number => {
  let revoked = 0;
  for (const [id, session] of state.sessions) {
    if (session.membershipId !== membershipId) continue;
    if (session.status !== 'active') continue;
    state.sessions.set(id, { ...session, status: 'revoked' });
    appendInMemoryAuditRecord(state, {
      type: 'session.revoked',
      sessionId: id as SessionId,
      actorMembershipId: template.actorMembershipId as MembershipId,
      occurredAt: template.occurredAt,
    });
    revoked += 1;
  }
  return revoked;
};

export const makeInMemoryAdminRepository = (
  state: AccessStoreState,
): AccessAdminRepository => ({
  findAccount: async (id) => {
    const account = state.accounts.get(id);
    return account
      ? { id, status: account.status, kind: accountKindOf(state, id) }
      : null;
  },
  disableAccount: async (id, event) => {
    state.accounts.set(id, { status: 'disabled' });
    appendInMemoryAuditRecord(state, event);
  },
  enableAccount: async (id, event) => {
    state.accounts.set(id, { status: 'active' });
    appendInMemoryAuditRecord(state, event);
  },
  findMembership: async (id) => {
    const membership = state.memberships.get(id);
    if (!membership) return null;
    return {
      id,
      accountId: membership.accountId as AccountId,
      accountKind: accountKindOf(state, membership.accountId),
      permissions: membership.permissions,
    };
  },
  promoteAccountToStaff: async (id, event, staffPolicy) =>
    promoteAccountToStaff(state, id, event, staffPolicy),
  updatePermissions: async (id, permissions, event, requireCoAdmin) => {
    const membership = state.memberships.get(id);
    if (!membership) return { orphaned: false };
    if (requireCoAdmin && !hasOtherAdmin(state, membership.accountId, id)) {
      return { orphaned: true };
    }
    state.memberships.set(id, { ...membership, permissions });
    appendInMemoryAuditRecord(state, event);
    return { orphaned: false };
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
    appendInMemoryAuditRecord(state, event);
  },
  revokeAllSessions: async (membershipId, template) =>
    revokeActiveSessions(state, membershipId, template),
  listSessions: async (membershipId) => listSessions(state, membershipId),
});

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
