import { type Brand, type Result, err, ok } from '@acme/shared';
import { invalidBillingDate, invalidBillingId } from '../errors';
import type { BillingDomainError } from '../errors';
import type { PlanEntitlements } from '../entitlements';
import type { Plan, PlanId } from '../plan/plan';

export type SubscriptionId = Brand<string, 'SubscriptionId'>;

export const makeSubscriptionId = (
  raw: string,
): Result<SubscriptionId, BillingDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidBillingId('Billing ids must not be empty.'));
  }
  return ok(value as SubscriptionId);
};

/**
 * One per customer account (staff accounts have none and are exempt). Stores
 * FACTS only — phase is derived, never stored (see `subscriptionPhase`).
 * `planId` is a live reference: plan edits propagate; the trial window alone
 * is frozen here at subscribe time (ADR-0016 D3).
 */
export type Subscription = {
  readonly id: SubscriptionId;
  readonly accountId: string;
  readonly planId: PlanId;
  /** Trial-farming audit trail: who created the org this bills. */
  readonly createdByUserId: string;
  readonly startedAt: string;
  /** NEVER null — equals `startedAt` when there is no trial. */
  readonly trialEndsAt: string;
  readonly paidThroughAt: string | null;
  readonly canceledAt: string | null;
  /** The per-org exception valve — one override, not a new plan. */
  readonly overrides: Partial<PlanEntitlements> | null;
};

/**
 * Pure calendar-month addition over ISO strings, clamping to the end of the
 * target month (Jan 31 + 1mo = Feb 28/29). Time-of-day is preserved.
 */
export const addMonths = (iso: string, months: number): string => {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
};

/** Date-only or full ISO-8601 UTC timestamp; staff setters validate shape. */
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/;

const isIsoDate = (value: string): boolean =>
  ISO_DATE_SHAPE.test(value) && !Number.isNaN(new Date(value).getTime());

export const startSubscription = (
  input: {
    readonly accountId: string;
    readonly plan: Plan;
    readonly createdByUserId: string;
    /**
     * The trial is a once-ever per-account AND per-creating-identity budget:
     * an identity's second org is born with its trial already consumed.
     */
    readonly trialAlreadyUsed: boolean;
  },
  deps: { readonly ids: () => string; readonly now: string },
): Subscription => {
  const skipTrial = input.trialAlreadyUsed || input.plan.trialMonths === 0;
  return {
    id: deps.ids() as SubscriptionId,
    accountId: input.accountId,
    planId: input.plan.id,
    createdByUserId: input.createdByUserId,
    startedAt: deps.now,
    trialEndsAt: skipTrial
      ? deps.now
      : addMonths(deps.now, input.plan.trialMonths),
    paidThroughAt: null,
    canceledAt: null,
    overrides: null,
  };
};

/** Stripe's vocabulary (ADR-0016); prose "expired" = phase `past_due`. */
export type SubscriptionPhase = 'trialing' | 'active' | 'past_due' | 'canceled';

const toMs = (iso: string): number => new Date(iso).getTime();

/**
 * Phase is derived from facts + an injected clock — no stored status to go
 * stale, so `markPaid`/`extendTrial`/plan change un-block instantly.
 */
export const subscriptionPhase = (
  sub: Subscription,
  now: string,
): SubscriptionPhase => {
  if (sub.canceledAt !== null) return 'canceled';
  if (toMs(now) < toMs(sub.trialEndsAt)) return 'trialing';
  if (sub.paidThroughAt !== null && toMs(now) < toMs(sub.paidThroughAt)) {
    return 'active';
  }
  return 'past_due';
};

/**
 * Swap the plan reference and NOTHING else. A plan change never grants a
 * fresh trial (the once-ever budget stays anchored at first subscribe) and
 * never moves the paid window (ADR-0016 D3).
 */
export const applyPlanChange = (
  sub: Subscription,
  newPlanId: PlanId,
): Subscription => ({ ...sub, planId: newPlanId });

/** Absolute setter ("paid through DATE") — idempotent under retries. */
export const markPaid = (
  sub: Subscription,
  paidThrough: string,
): Result<Subscription, BillingDomainError> => {
  if (!isIsoDate(paidThrough)) {
    return err(invalidBillingDate(`"${paidThrough}" is not an ISO date.`));
  }
  return ok({ ...sub, paidThroughAt: paidThrough });
};

/** Absolute setter ("trial ends DATE") — the only way to grant a new trial. */
export const extendTrial = (
  sub: Subscription,
  trialEndsAt: string,
): Result<Subscription, BillingDomainError> => {
  if (!isIsoDate(trialEndsAt)) {
    return err(invalidBillingDate(`"${trialEndsAt}" is not an ISO date.`));
  }
  return ok({ ...sub, trialEndsAt });
};

/** Idempotent: a second cancel keeps the original `canceledAt` fact. */
export const cancelSubscription = (
  sub: Subscription,
  now: string,
): Subscription => ({ ...sub, canceledAt: sub.canceledAt ?? now });

export const setOverride = (
  sub: Subscription,
  overrides: Partial<PlanEntitlements> | null,
): Subscription => ({ ...sub, overrides });
