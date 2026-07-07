import type { PlanEntitlements, PlanFeature } from '../entitlements';
import type { Plan } from '../plan/plan';
import { subscriptionPhase } from '../subscription/subscription';
import type { Subscription } from '../subscription/subscription';

/**
 * The entitlement checks: pure, deterministic decision functions — the billing
 * mirror of `evaluateAccessPolicy`. A denial is a valid decision, not an error
 * (hence no `Result`); the application layer maps decisions to its upsell-grade
 * tags (`app/plan-limit-exceeded` → 409, `app/subscription-expired` → 402 —
 * never 403, which stays reserved for authorization).
 */

/** Effective entitlements: the live plan with the per-org exception applied.
 * Limits shallow-merge; a features override REPLACES the plan's list. */
export const resolveEntitlements = (
  plan: Plan,
  overrides: Partial<PlanEntitlements> | null,
): PlanEntitlements => ({
  limits: { ...plan.entitlements.limits, ...(overrides?.limits ?? {}) },
  features: overrides?.features ?? plan.entitlements.features,
});

export type LimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'limit-exceeded' };

/**
 * May usage grow by one? Growth-only: over-limit state (5/3 after a downgrade)
 * is legal and never evicted — it just cannot grow further.
 */
export const checkLimit = (input: {
  readonly max: number | null;
  readonly usage: number;
}): LimitDecision =>
  input.max === null || input.usage + 1 <= input.max
    ? { allowed: true }
    : { allowed: false, reason: 'limit-exceeded' };

export const hasFeature = (
  entitlements: PlanEntitlements,
  feature: PlanFeature,
): boolean => entitlements.features.includes(feature);

export type BillingHoldReason =
  | 'subscription-past-due'
  | 'subscription-canceled';

export type BillingHoldDecision =
  | { readonly held: false }
  | { readonly held: true; readonly reason: BillingHoldReason };

const DAY_MS = 86_400_000;

/**
 * The account-wide billing hold (ADR-0016 Decision 5). Held iff canceled, or
 * past_due on a PRICED plan once the grace window — anchored at when the price
 * was first set — has elapsed. You cannot be delinquent on a plan that had no
 * price while you expired: without this, a pricing launch would mass-lock the
 * backlog of unpriced-era expirees on day one.
 */
export const billingHold = (input: {
  readonly sub: Subscription;
  readonly plan: Plan;
  readonly now: string;
  readonly graceDays: number;
}): BillingHoldDecision => {
  const phase = subscriptionPhase(input.sub, input.now);
  if (phase === 'canceled') {
    return { held: true, reason: 'subscription-canceled' };
  }
  if (phase !== 'past_due') return { held: false };
  const { price, priceSetAt } = input.plan;
  if (price === null || priceSetAt === null) return { held: false };
  const graceEndsMs = new Date(priceSetAt).getTime() + input.graceDays * DAY_MS;
  return new Date(input.now).getTime() > graceEndsMs
    ? { held: true, reason: 'subscription-past-due' }
    : { held: false };
};
