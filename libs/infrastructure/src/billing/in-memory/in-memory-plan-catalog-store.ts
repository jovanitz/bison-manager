import type { PlanCatalogStore } from '@acme/application';
import type { Plan } from '@acme/domain';
import type {
  BillingStoreState,
  StoredSubscription,
} from './billing-store-state';

/**
 * In-memory {@link PlanCatalogStore} over the shared billing state — the
 * reference the Postgres adapter is contract-tested against. Writes are
 * CAS-guarded (`version`; `null` = create, key-unique) and append their
 * billing event in the same synchronous mutation (= the Postgres
 * transaction); a conflict writes nothing, event included.
 */
export type InMemoryPlanCatalogDeps = {
  /** Current member count of one org — the blast-radius preview input. */
  readonly countMembers: (accountId: string) => Promise<number>;
};

const subscribersOf = (
  state: BillingStoreState,
  planId: string,
): ReadonlyArray<StoredSubscription> =>
  [...state.subscriptions.values()]
    .filter((entry) => entry.sub.planId === planId)
    .sort((a, b) => a.sub.startedAt.localeCompare(b.sub.startedAt));

const writePlan = (
  state: BillingStoreState,
  plan: Plan,
  expectedVersion: number | null,
): 'ok' | 'conflict' => {
  if (expectedVersion === null) {
    const keyTaken = [...state.plans.values()].some((p) => p.key === plan.key);
    if (keyTaken || state.plans.has(plan.id)) return 'conflict';
    state.plans.set(plan.id, plan);
    return 'ok';
  }
  const current = state.plans.get(plan.id);
  if (!current || current.version !== expectedVersion) return 'conflict';
  state.plans.set(plan.id, plan);
  return 'ok';
};

export const createInMemoryPlanCatalogStore = (
  state: BillingStoreState,
  deps: InMemoryPlanCatalogDeps,
): PlanCatalogStore => ({
  listPlans: async () =>
    [...state.plans.values()].sort((a, b) => a.key.localeCompare(b.key)),

  findPlanById: async (planId) => state.plans.get(planId) ?? null,

  findPlanByKey: async (key) =>
    [...state.plans.values()].find((plan) => plan.key === key) ?? null,

  findDefaultPlan: async () =>
    [...state.plans.values()].find((plan) => plan.isDefaultForNewOrgs) ?? null,

  countSubscribers: async (planId) => subscribersOf(state, planId).length,

  listSubscribers: async (planId) =>
    subscribersOf(state, planId).map((entry) => ({
      accountId: entry.sub.accountId,
      since: entry.sub.startedAt,
    })),

  // v1 approximation (documented in the port): per-org feature usage is not
  // tracked, so losing any feature counts EVERY subscriber; over-limit
  // compares each subscribed org's CURRENT member count against the next cap.
  previewImpact: async (planId, next) => {
    const current = state.plans.get(planId);
    const subs = subscribersOf(state, planId);
    const counts = await Promise.all(
      subs.map((entry) => deps.countMembers(entry.sub.accountId)),
    );
    const features = current?.entitlements.features ?? [];
    const losesFeature = features.some((f) => !next.features.includes(f));
    const max = next.limits.maxMembersPerOrg;
    return {
      wouldGoOverLimit:
        max === null ? 0 : counts.filter((members) => members > max).length,
      wouldLoseFeature: losesFeature ? subs.length : 0,
    };
  },

  savePlan: async (plan, expectedVersion, event) => {
    const written = writePlan(state, plan, expectedVersion);
    if (written === 'ok') state.events.push(event);
    return written;
  },

  setDefaultPlan: async (planId, event) => {
    for (const [id, plan] of state.plans) {
      state.plans.set(id, { ...plan, isDefaultForNewOrgs: id === planId });
    }
    state.events.push(event);
  },
});
