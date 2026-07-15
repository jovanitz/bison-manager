import { accessSessionExpiryFrom } from '@acme/domain';
import type {
  AccessAccountDeletionCanceled,
  AccessAccountDeletionScheduled,
  AccessAccountDemoted,
  AccessAccountPromoted,
  AccessSessionPolicy,
  AccountId,
} from '@acme/domain';
import { appendInMemoryAuditRecord } from '../in-memory/audit-trail';
import type { AccessStoreState } from '../in-memory/seed/access-seed';

/** In-memory account-lifecycle mutations: promote/demote + deletion schedule. */
export const promoteAccountToStaff = (
  state: AccessStoreState,
  id: AccountId,
  event: AccessAccountPromoted,
  staffPolicy: AccessSessionPolicy,
): void => {
  const account = state.accounts.get(id);
  if (account) state.accounts.set(id, { ...account, kind: 'staff' });
  tightenAccountSessions(state, id, staffPolicy);
  appendInMemoryAuditRecord(state, event);
};

/** Re-bound every active session of an account under a (new) session policy. */
const tightenAccountSessions = (
  state: AccessStoreState,
  id: AccountId,
  policy: AccessSessionPolicy,
): void => {
  for (const [sessionId, session] of state.sessions) {
    const membership = state.memberships.get(session.membershipId);
    if (membership?.accountId !== id || session.status !== 'active') continue;
    const bounded = accessSessionExpiryFrom(
      policy,
      session.createdAt,
      session.lastSeenAt,
    );
    if (new Date(bounded).getTime() < new Date(session.expiresAt).getTime()) {
      state.sessions.set(sessionId, { ...session, expiresAt: bounded });
    }
  }
};

/**
 * Demote: flip kind back to customer, STRIP every membership's roles (staff-grade
 * permissions must not survive on a customer account — that is the whole security
 * point), and re-bind sessions under the customer policy.
 */
export const demoteAccountToCustomer = (
  state: AccessStoreState,
  id: AccountId,
  event: AccessAccountDemoted,
  customerPolicy: AccessSessionPolicy,
): void => {
  const account = state.accounts.get(id);
  if (account) state.accounts.set(id, { ...account, kind: 'customer' });
  for (const [mid, membership] of state.memberships) {
    if (membership.accountId !== id) continue;
    state.memberships.set(mid, { ...membership, roleIds: [] });
  }
  tightenAccountSessions(state, id, customerPolicy);
  appendInMemoryAuditRecord(state, event);
};

/** Set (or clear) an account's scheduled-deletion date, audited. */
export const setPendingDeletion = (
  state: AccessStoreState,
  id: AccountId,
  pendingDeletionUntil: string | null,
  event: AccessAccountDeletionScheduled | AccessAccountDeletionCanceled,
): void => {
  const account = state.accounts.get(id);
  if (account) state.accounts.set(id, { ...account, pendingDeletionUntil });
  appendInMemoryAuditRecord(state, event);
};
