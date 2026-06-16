import type { AccessBlockStore } from '@acme/application';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

/** In-memory soft-block store, sharing the store state (same rules as Postgres). */
export const makeInMemoryBlockStore = (
  state: AccessStoreState,
): AccessBlockStore => ({
  isOrgBlocked: async (accountId) =>
    state.accounts.get(accountId)?.blocked ?? false,
  setOrgBlocked: async (accountId, blocked, event) => {
    const prev = state.accounts.get(accountId);
    if (prev) state.accounts.set(accountId, { ...prev, blocked });
    appendInMemoryAuditRecord(state, event);
  },
  isIdentityBlocked: async (userId) => state.blockedIdentities.has(userId),
  setIdentityBlocked: async (userId, blocked, event) => {
    if (blocked) state.blockedIdentities.add(userId);
    else state.blockedIdentities.delete(userId);
    appendInMemoryAuditRecord(state, event);
  },
  isIdentityRoot: async (userId) =>
    [...state.memberships.values()].some(
      (m) => m.isRoot && m.userId === userId,
    ),
  isMembershipBlocked: async (membershipId) =>
    state.blockedMemberships.has(membershipId),
  setMembershipBlocked: async (membershipId, blocked, event) => {
    if (blocked) state.blockedMemberships.add(membershipId);
    else state.blockedMemberships.delete(membershipId);
    appendInMemoryAuditRecord(state, event);
  },
});
