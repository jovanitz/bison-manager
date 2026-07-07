import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  billingHold,
  checkLimit,
  hasFeature,
  resolveEntitlements,
  subscriptionPhase,
} from '@acme/domain';
import type { Plan, PlanFeature, Subscription } from '@acme/domain';
import type { PlanCatalogStore } from '../billing-plans/ports';
import {
  defaultPlanMissing,
  featureNotInPlan,
  planLimitExceeded,
  subscriptionExpired,
  subscriptionNotFound,
} from './errors';
import type { BillingSubscriptionsUseCaseError } from './errors';
import type {
  BillingAccountRef,
  EntitlementUsageReader,
  SubscriptionStore,
} from './ports';

/**
 * The entitlement enforcement points (ADR-0016 Decision 4/5). Guards gate
 * GROWTH mutations and premium features only — never evict, never auto-repair.
 * STAFF accounts short-circuit `ok`: billing never gates staff. A customer
 * account with no subscription (crash, seed mistake) is FAIL-CLOSED for
 * growth. Denials carry upsell-grade tags, never `app/access-denied`.
 */
export type EntitlementGuardsDeps = {
  readonly subscriptions: SubscriptionStore;
  readonly plans: Pick<PlanCatalogStore, 'findPlanById' | 'findDefaultPlan'>;
  readonly usage: EntitlementUsageReader;
  readonly clock: Clock;
  /** Delinquency grace window, anchored at when the plan's price was set. */
  readonly graceDays: number;
};

type GuardResult = Promise<Result<void, BillingSubscriptionsUseCaseError>>;

type AccountBilling = { readonly sub: Subscription; readonly plan: Plan };

/** Load sub + live plan; either missing = fail closed (not-found). */
const loadAccountBilling = async (
  deps: EntitlementGuardsDeps,
  accountId: string,
): Promise<Result<AccountBilling, BillingSubscriptionsUseCaseError>> => {
  const sub = await deps.subscriptions.findByAccount(accountId);
  if (!sub) {
    return err(subscriptionNotFound(`No subscription for org ${accountId}.`));
  }
  const plan = await deps.plans.findPlanById(sub.planId);
  if (!plan) {
    return err(subscriptionNotFound(`No plan for subscription ${sub.id}.`));
  }
  return ok({ sub, plan });
};

/**
 * The billing-hold decision shared by `guardHold`/`guardFeature`. Observing a
 * `past_due` phase lazily records `subscription.trial-expired` (CAS-guarded by
 * the store: concurrent observers emit ONE event, not N) regardless of the
 * hold outcome — the hold itself also needs a priced plan + elapsed grace.
 */
const holdCheck = async (
  deps: EntitlementGuardsDeps,
  { sub, plan }: AccountBilling,
): GuardResult => {
  const now = deps.clock.now().toISOString();
  if (subscriptionPhase(sub, now) === 'past_due') {
    await deps.subscriptions.recordTrialExpired(sub.id, {
      type: 'subscription.trial-expired',
      subscriptionId: sub.id,
      accountId: sub.accountId,
      trialEndsAt: sub.trialEndsAt,
      occurredAt: now,
    });
  }
  const hold = billingHold({ sub, plan, now, graceDays: deps.graceDays });
  if (hold.held) {
    return err(
      subscriptionExpired(`Org ${sub.accountId} is held for payment.`, {
        details: { reason: hold.reason },
      }),
    );
  }
  return ok(undefined);
};

/**
 * Pre-actor gate for org creation: counted against the DEFAULT plan the new
 * org would be born on, per-plan (ADR-0016 D2 — a custom multi-org deal on
 * another plan does not consume these slots). No default plan = fail closed.
 */
const makeGuardOrgCreation =
  (deps: EntitlementGuardsDeps) =>
  async (input: { readonly userId: string }): GuardResult => {
    const plan = await deps.plans.findDefaultPlan();
    if (!plan) {
      return err(defaultPlanMissing('No default plan for new orgs is set.'));
    }
    const usage = await deps.usage.countOwnedOrgsOnPlan(input.userId, plan.key);
    const decision = checkLimit({
      max: plan.entitlements.limits.maxOrganizationsOwned,
      usage,
    });
    if (!decision.allowed) {
      return err(
        planLimitExceeded(`Plan "${plan.key}" org-ownership limit reached.`),
      );
    }
    return ok(undefined);
  };

/** May the org grow by one member? (Invitations never reserve seats.) */
const makeGuardSeat =
  (deps: EntitlementGuardsDeps) =>
  async (input: { readonly account: BillingAccountRef }): GuardResult => {
    if (input.account.kind === 'staff') return ok(undefined);
    const loaded = await loadAccountBilling(deps, input.account.accountId);
    if (!loaded.ok) return err(loaded.error);
    const { limits } = resolveEntitlements(
      loaded.value.plan,
      loaded.value.sub.overrides,
    );
    const decision = checkLimit({
      max: limits.maxMembersPerOrg,
      usage: await deps.usage.countMembers(input.account.accountId),
    });
    if (!decision.allowed) {
      return err(planLimitExceeded('The organization is at its seat limit.'));
    }
    return ok(undefined);
  };

/** The account-wide billing hold (phase gate, NOT `access.block`). */
const makeGuardHold =
  (deps: EntitlementGuardsDeps) =>
  async (input: { readonly account: BillingAccountRef }): GuardResult => {
    if (input.account.kind === 'staff') return ok(undefined);
    const loaded = await loadAccountBilling(deps, input.account.accountId);
    if (!loaded.ok) return err(loaded.error);
    return holdCheck(deps, loaded.value);
  };

/** Premium feature gate; the hold denial always wins over a feature miss. */
const makeGuardFeature =
  (deps: EntitlementGuardsDeps) =>
  async (input: {
    readonly account: BillingAccountRef;
    readonly feature: PlanFeature;
  }): GuardResult => {
    if (input.account.kind === 'staff') return ok(undefined);
    const loaded = await loadAccountBilling(deps, input.account.accountId);
    if (!loaded.ok) return err(loaded.error);
    const held = await holdCheck(deps, loaded.value);
    if (!held.ok) return err(held.error);
    const entitlements = resolveEntitlements(
      loaded.value.plan,
      loaded.value.sub.overrides,
    );
    if (!hasFeature(entitlements, input.feature)) {
      return err(
        featureNotInPlan(`The plan does not include "${input.feature}".`),
      );
    }
    return ok(undefined);
  };

/**
 * Resolved seat ceiling (overrides applied) for the transactional attach-time
 * check inside `acceptInvitation` (ADR-0016 D1); `null` = unlimited — staff
 * accounts always (billing never gates staff), and unlimited plans. A missing
 * sub/plan on a customer org = 0 (fail closed for growth).
 */
const makeSeatLimitFor =
  (deps: EntitlementGuardsDeps) =>
  async (account: BillingAccountRef): Promise<number | null> => {
    if (account.kind === 'staff') return null;
    const loaded = await loadAccountBilling(deps, account.accountId);
    if (!loaded.ok) return 0;
    return resolveEntitlements(loaded.value.plan, loaded.value.sub.overrides)
      .limits.maxMembersPerOrg;
  };

export const makeEntitlementGuards = (deps: EntitlementGuardsDeps) => ({
  guardOrgCreation: makeGuardOrgCreation(deps),
  guardSeat: makeGuardSeat(deps),
  guardHold: makeGuardHold(deps),
  guardFeature: makeGuardFeature(deps),
  seatLimitFor: makeSeatLimitFor(deps),
});

export type EntitlementGuards = ReturnType<typeof makeEntitlementGuards>;
