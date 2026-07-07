import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  EntitlementUsageReader,
  PlanCatalogStore,
  SubscriptionStore,
} from '@acme/application';
import type { AccountId, UserId } from '@acme/domain';

/**
 * Store-agnostic {@link EntitlementUsageReader} — COMPOSED over existing
 * ports (the `makeOrgDetailReader` precedent), so the same factory works over
 * any store pairing (the in-memory access + billing stores today; a Postgres
 * deployment can wire `createPostgresEntitlementUsageReader` instead, which
 * does the same counting in SQL).
 *
 * - `countMembers`: the org's CURRENT membership count (seat checks — counted
 *   live, never cached).
 * - `countOwnedOrgsOnPlan` (ADR-0016 D2): orgs the user OWNS
 *   (`isAccountOwner`) whose subscription sits on `planKey` — per-plan
 *   counting, so a custom multi-org deal never consumes Free slots.
 */
export const makeEntitlementUsageReader = (deps: {
  readonly members: Pick<
    AccessMemberDirectory,
    'listMembers' | 'listMembershipsByUser'
  >;
  readonly admin: Pick<AccessAdminRepository, 'findMembership'>;
  readonly subscriptions: Pick<SubscriptionStore, 'findByAccount'>;
  readonly plans: Pick<PlanCatalogStore, 'findPlanById'>;
}): EntitlementUsageReader => ({
  countMembers: async (accountId) =>
    (await deps.members.listMembers(accountId as AccountId)).length,

  countOwnedOrgsOnPlan: async (userId, planKey) => {
    const mine = await deps.members.listMembershipsByUser(userId as UserId);
    let count = 0;
    for (const entry of mine) {
      const membership = await deps.admin.findMembership(entry.membershipId);
      if (!membership?.isAccountOwner) continue;
      const sub = await deps.subscriptions.findByAccount(entry.accountId);
      if (!sub) continue;
      const plan = await deps.plans.findPlanById(sub.planId);
      if (plan?.key === planKey) count += 1;
    }
    return count;
  },
});
