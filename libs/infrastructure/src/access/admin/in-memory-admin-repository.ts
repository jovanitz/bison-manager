import type {
  AccessAdminRepository,
  AdminSessionDetail,
} from '@acme/application';
import type {
  AccessAccountDisabled,
  AccessAccountEnabled,
  AccountId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import type {
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
} from '@acme/application';
import { appendInMemoryAuditRecord } from '../in-memory/audit-trail';
import {
  demoteAccountToCustomer,
  promoteAccountToStaff,
  setPendingDeletion,
} from './in-memory-account-lifecycle';
import { accountKindOf } from '../in-memory/seed/access-seed';
import type { AccessStoreState } from '../in-memory/seed/access-seed';
import {
  assignMembershipRoles,
  hasOtherAdmin,
  oneOffPermissions,
  upsertPersonalRole,
} from './in-memory-membership-perms';

export {
  hasOtherAdmin,
  oneOffPermissions,
  removeWouldOrphan,
} from './in-memory-membership-perms';

/** Shared by the admin repo and the member directory (which lives apart). */
// account kind is read via the canonical `accountKindOf` (explicit kind).

const accountHostsRoot = (
  state: AccessStoreState,
  accountId: string,
): boolean =>
  [...state.memberships.values()].some(
    (m) => m.accountId === accountId && m.isRoot,
  );

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

/** Set account status, preserving the soft-block flag + recording the event. */
const setAccountStatus = (
  state: AccessStoreState,
  id: AccountId,
  status: 'active' | 'disabled',
  event: AccessAccountDisabled | AccessAccountEnabled,
): void => {
  const prev = state.accounts.get(id);
  state.accounts.set(id, {
    status,
    blocked: prev?.blocked ?? false,
    kind: prev?.kind ?? 'staff',
    pendingDeletionUntil: prev?.pendingDeletionUntil ?? null,
  });
  appendInMemoryAuditRecord(state, event);
};

const findAccount = (
  state: AccessStoreState,
  id: AccountId,
): AdminAccountSnapshot | null => {
  const account = state.accounts.get(id);
  return account
    ? {
        id,
        status: account.status,
        kind: accountKindOf(state, id),
        hostsRoot: accountHostsRoot(state, id),
        pendingDeletionUntil: account.pendingDeletionUntil,
      }
    : null;
};

const findMembership = (
  state: AccessStoreState,
  id: MembershipId,
): AdminMembershipSnapshot | null => {
  const membership = state.memberships.get(id);
  if (!membership) return null;
  return {
    id,
    accountId: membership.accountId as AccountId,
    accountKind: accountKindOf(state, membership.accountId),
    permissions: oneOffPermissions(state, membership),
    isRoot: membership.isRoot,
    isAccountOwner: membership.isAccountOwner,
  };
};

export const makeInMemoryAdminRepository = (
  state: AccessStoreState,
): AccessAdminRepository => ({
  findAccount: async (id) => findAccount(state, id),
  disableAccount: async (id, event) =>
    setAccountStatus(state, id, 'disabled', event),
  enableAccount: async (id, event) =>
    setAccountStatus(state, id, 'active', event),
  findMembership: async (id) => findMembership(state, id),
  promoteAccountToStaff: async (id, event, staffPolicy) =>
    promoteAccountToStaff(state, id, event, staffPolicy),
  demoteAccountToCustomer: async (id, event, customerPolicy) =>
    demoteAccountToCustomer(state, id, event, customerPolicy),
  scheduleAccountDeletion: async (id, purgeAt, event) =>
    setPendingDeletion(state, id, purgeAt, event),
  cancelAccountDeletion: async (id, event) =>
    setPendingDeletion(state, id, null, event),
  updatePermissions: async (id, permissions, event, requireCoAdmin) => {
    const membership = state.memberships.get(id);
    if (!membership) return { orphaned: false };
    if (requireCoAdmin && !hasOtherAdmin(state, membership.accountId, id)) {
      return { orphaned: true };
    }
    upsertPersonalRole(state, id, membership, permissions);
    appendInMemoryAuditRecord(state, event);
    return { orphaned: false };
  },
  assignRoles: async (id, roleIds, event) =>
    assignMembershipRoles(state, id, roleIds, event),
  findSession: async (id) => {
    const session = state.sessions.get(id);
    const membership = session && state.memberships.get(session.membershipId);
    if (!session || !membership) return null;
    return {
      id,
      accountId: membership.accountId as AccountId,
      status: session.status,
      isRoot: membership.isRoot,
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
