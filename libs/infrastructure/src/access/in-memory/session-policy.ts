import type {
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
} from '@acme/application';
import {
  ACCESS_SESSION_POLICY_DEFAULTS,
  accessSessionExpiryFrom,
} from '@acme/domain';
import type { AccessSessionPolicies, AccountKind } from '@acme/domain';
import { appendInMemoryAuditRecord } from './audit-trail';
import type { AccessStoreState } from './access-seed';

/**
 * In-memory session-policy store + activity recorder, sharing the store
 * state. Mirrors the transactional promise of the Postgres adapter: saving a
 * policy persists it, audits it, and immediately shrinks every live session
 * (tightening acts now; loosening is only gained through later slides).
 */
const accountKindOf = (
  state: AccessStoreState,
  accountId: string,
): AccountKind => (state.customers.has(accountId) ? 'customer' : 'staff');

const shrinkLiveSessions = (
  state: AccessStoreState,
  policies: AccessSessionPolicies,
): void => {
  for (const [id, session] of state.sessions) {
    if (session.status !== 'active') continue;
    const membership = state.memberships.get(session.membershipId);
    if (!membership) continue;
    const policy = policies[accountKindOf(state, membership.accountId)];
    const bounded = accessSessionExpiryFrom(
      policy,
      session.createdAt,
      session.lastSeenAt,
    );
    if (new Date(bounded).getTime() < new Date(session.expiresAt).getTime()) {
      state.sessions.set(id, { ...session, expiresAt: bounded });
    }
  }
};

export const makeInMemorySessionPolicyStore = (
  state: AccessStoreState,
): AccessSessionPolicyStore => ({
  loadSessionPolicies: async () =>
    state.settings?.policies ?? ACCESS_SESSION_POLICY_DEFAULTS,
  loadSessionSettings: async () =>
    state.settings ?? {
      policies: ACCESS_SESSION_POLICY_DEFAULTS,
      version: 1,
    },
  saveSessionPolicies: async (policies, event, expectedVersion) => {
    const currentVersion = state.settings?.version ?? 1;
    if (currentVersion !== expectedVersion) return false;
    state.settings = { policies, version: currentVersion + 1 };
    appendInMemoryAuditRecord(state, event);
    shrinkLiveSessions(state, policies);
    return true;
  },
});

export const makeInMemorySessionActivityRecorder = (
  state: AccessStoreState,
): AccessSessionActivityRecorder => ({
  recordSessionActivity: async (activity) => {
    const session = state.sessions.get(activity.sessionId);
    if (!session || session.status !== 'active') return;
    // Same guard as the Postgres adapter: never slide an expired session.
    if (
      new Date(session.expiresAt).getTime() <=
      new Date(activity.lastSeenAt).getTime()
    ) {
      return;
    }
    state.sessions.set(activity.sessionId, {
      ...session,
      expiresAt: activity.expiresAt,
      lastSeenAt: activity.lastSeenAt,
      lastIp: activity.ipAddress ?? session.lastIp,
    });
  },
});
