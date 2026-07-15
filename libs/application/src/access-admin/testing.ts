import { fixedClock } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type {
  AccessAuditEvent,
  AccessPermission,
  AccountId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import { TEST_ACCESS_NOW } from '../access/testing';
import type {
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
  AdminSessionSnapshot,
} from './ports';

/** Snapshot builders shared by the access-admin specs. */
export const testAdminAccount = (
  id: string,
  status = 'active',
  hostsRoot = false,
): AdminAccountSnapshot => ({
  id: id as AccountId,
  status: status as AdminAccountSnapshot['status'],
  kind: 'customer',
  hostsRoot,
  pendingDeletionUntil: null,
});

export const testAdminSession = (
  id: string,
  accountId: string,
  status = 'active',
  isRoot = false,
): AdminSessionSnapshot => ({
  id: id as SessionId,
  accountId: accountId as AccountId,
  status: status as AdminSessionSnapshot['status'],
  isRoot,
});

export const testAdminDeps = (admin: ReturnType<typeof inMemoryAdmin>) => ({
  admin: admin.port,
  settings: {
    loadSessionPolicies: async () => ACCESS_SESSION_POLICY_DEFAULTS,
  },
  clock: fixedClock(new Date(TEST_ACCESS_NOW)),
});

/** Is there an administrator of the account OTHER than `exceptId`? */
const hasOtherAdmin = (
  memberships: Map<MembershipId, AdminMembershipSnapshot>,
  accountId: AccountId,
  exceptId: MembershipId,
): boolean =>
  [...memberships].some(
    ([id, m]) =>
      id !== exceptId &&
      m.accountId === accountId &&
      m.permissions.some((p) => p.action === 'permissions.update'),
  );

/** Session half of the fake port (split to stay within function limits). */
const sessionMethods = (
  sessions: Map<SessionId, AdminSessionSnapshot>,
  audit: AccessAuditEvent[],
) => ({
  findSession: async (id: SessionId) => sessions.get(id) ?? null,
  revokeSession: async (id: SessionId, event: AccessAuditEvent) => {
    const session = sessions.get(id);
    if (session) sessions.set(id, { ...session, status: 'revoked' });
    audit.push(event);
  },
  revokeAllSessions: async (
    _membershipId: MembershipId,
    template: { actorMembershipId: MembershipId; occurredAt: string },
  ) => {
    let revoked = 0;
    for (const [id, session] of sessions) {
      if (session.status !== 'active') continue;
      sessions.set(id, { ...session, status: 'revoked' });
      audit.push({
        type: 'session.revoked',
        sessionId: id,
        actorMembershipId: template.actorMembershipId,
        occurredAt: template.occurredAt,
      });
      revoked += 1;
    }
    return revoked;
  },
  // the fake mirrors revokeAllSessions: every stored session "belongs" to
  // the queried membership, with a fixed synthesized context
  listSessions: async () =>
    [...sessions.values()].map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: TEST_ACCESS_NOW,
      lastSeenAt: TEST_ACCESS_NOW,
      expiresAt: '2026-06-09T18:00:00.000Z',
      userAgent: 'spec-agent',
      createdIp: '198.51.100.4',
      lastIp: '198.51.100.4',
    })),
});

type AccountMap = Map<AccountId, AdminAccountSnapshot>;
type MembershipMap = Map<MembershipId, AdminMembershipSnapshot>;

/** Patch an account in place + record the event (closes over accounts+audit). */
const accountPatcher =
  (accounts: AccountMap, audit: AccessAuditEvent[]) =>
  (
    id: AccountId,
    fields: Partial<AdminAccountSnapshot>,
    event: AccessAuditEvent,
  ): void => {
    const account = accounts.get(id);
    if (account) accounts.set(id, { ...account, ...fields });
    audit.push(event);
  };

/** Account half of the fake port (split to stay within function limits). */
const accountMethods = (
  accounts: AccountMap,
  memberships: MembershipMap,
  audit: AccessAuditEvent[],
) => {
  const patch = accountPatcher(accounts, audit);
  return {
    findAccount: async (id: AccountId) => accounts.get(id) ?? null,
    findMembership: async (id: MembershipId) => memberships.get(id) ?? null,
    disableAccount: async (id: AccountId, event: AccessAuditEvent) =>
      patch(id, { status: 'disabled' }, event),
    enableAccount: async (id: AccountId, event: AccessAuditEvent) =>
      patch(id, { status: 'active' }, event),
    promoteAccountToStaff: async (id: AccountId, event: AccessAuditEvent) =>
      patch(id, { kind: 'staff' }, event),
    demoteAccountToCustomer: async (id: AccountId, event: AccessAuditEvent) => {
      for (const [mid, m] of memberships) {
        if (m.accountId === id) memberships.set(mid, { ...m, permissions: [] });
      }
      patch(id, { kind: 'customer' }, event);
    },
    scheduleAccountDeletion: async (
      id: AccountId,
      purgeAt: string,
      event: AccessAuditEvent,
    ) => patch(id, { pendingDeletionUntil: purgeAt }, event),
    cancelAccountDeletion: async (id: AccountId, event: AccessAuditEvent) =>
      patch(id, { pendingDeletionUntil: null }, event),
    updatePermissions: async (
      id: MembershipId,
      permissions: ReadonlyArray<AccessPermission>,
      event: AccessAuditEvent,
      requireCoAdmin: boolean,
    ) => {
      const membership = memberships.get(id);
      if (!membership) return { orphaned: false };
      if (
        requireCoAdmin &&
        !hasOtherAdmin(memberships, membership.accountId, id)
      )
        return { orphaned: true };
      memberships.set(id, { ...membership, permissions });
      audit.push(event);
      return { orphaned: false };
    },
  };
};

/** Spec double for the AccessAdminRepository (test-only by convention). */
export const inMemoryAdmin = (seed: {
  accounts?: AdminAccountSnapshot[];
  memberships?: AdminMembershipSnapshot[];
  sessions?: AdminSessionSnapshot[];
}) => {
  const accounts: AccountMap = new Map(seed.accounts?.map((a) => [a.id, a]));
  const memberships: MembershipMap = new Map(
    seed.memberships?.map((m) => [m.id, m]),
  );
  const sessions = new Map(seed.sessions?.map((s) => [s.id, s]));
  const audit: AccessAuditEvent[] = [];
  return {
    audit,
    accounts,
    sessions,
    memberships,
    port: {
      ...accountMethods(accounts, memberships, audit),
      ...sessionMethods(sessions, audit),
    },
  };
};
