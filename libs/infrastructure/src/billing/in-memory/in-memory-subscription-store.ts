import type { SubscriptionStore } from '@acme/application';
import type { BillingStoreState } from './billing-store-state';

/**
 * In-memory {@link SubscriptionStore} over the shared billing state — the
 * reference the Postgres adapter is contract-tested against. Upserts are
 * keyed by account (`unique(account_id)`): the birth facts (id, creating
 * identity, startedAt) are written once and immutable; the staff levers
 * replace only the mutable facts. Every write appends its billing event in
 * the same synchronous mutation (= the Postgres transaction), and the
 * trial-expiry recording is CAS-guarded so concurrent observers emit ONE
 * event, not N (the `grant.expired` precedent).
 */
export const createInMemorySubscriptionStore = (
  state: BillingStoreState,
): SubscriptionStore => ({
  findByAccount: async (accountId) =>
    state.subscriptions.get(accountId)?.sub ?? null,

  save: async (sub, event) => {
    const existing = state.subscriptions.get(sub.accountId);
    const next = existing
      ? {
          ...sub,
          id: existing.sub.id,
          createdByUserId: existing.sub.createdByUserId,
          startedAt: existing.sub.startedAt,
        }
      : sub;
    state.subscriptions.set(sub.accountId, {
      sub: next,
      trialExpiryRecordedAt: existing?.trialExpiryRecordedAt ?? null,
    });
    state.events.push(event);
  },

  hasTrialConsumedByUser: async (userId) =>
    [...state.subscriptions.values()].some(
      (entry) => entry.sub.createdByUserId === userId,
    ),

  recordTrialExpired: async (subscriptionId, event) => {
    const entry = [...state.subscriptions.entries()].find(
      ([, stored]) => stored.sub.id === subscriptionId,
    );
    if (!entry || entry[1].trialExpiryRecordedAt !== null) return false;
    state.subscriptions.set(entry[0], {
      ...entry[1],
      trialExpiryRecordedAt: event.occurredAt,
    });
    state.events.push(event);
    return true;
  },
});
