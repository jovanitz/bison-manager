import { type Result, err, ok } from '@acme/shared';
import {
  billingHold,
  makeAccountId,
  resolveEntitlements,
  subscriptionPhase,
} from '@acme/domain';
import type {
  AccessActor,
  PlanFeature,
  PlanId,
  PlanPrice,
  SubscriptionPhase,
} from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { subscriptionNotFound } from './errors';
import type { BillingSubscriptionsUseCaseError } from './errors';
import {
  makeChangePlan,
  makeExtendTrial,
  makeMarkPaid,
  makeSetOverride,
} from './mutations/mutations';
import type { BillingSubscriptionsDeps } from './mutations/mutations';

export type { BillingSubscriptionsDeps } from './mutations/mutations';

/**
 * One org's billing state for the customer billing screen and the staff org
 * detail. Everything is DERIVED from facts + the injected clock — no stored
 * status to go stale, so `markPaid`/`extendTrial`/plan change un-block
 * instantly. Seats/features reflect the resolved entitlements (live plan with
 * the per-org overrides applied); `overLimit` is legal, visible state.
 */
export type BillingSummary = {
  readonly accountId: string;
  readonly planId: PlanId;
  readonly planKey: string;
  /** Customer-facing name — customers never see the plan `key`. */
  readonly planName: string;
  readonly phase: SubscriptionPhase;
  readonly trialEndsAt: string;
  readonly paidThroughAt: string | null;
  readonly seats: { readonly used: number; readonly max: number | null };
  readonly overLimit: boolean;
  readonly price: PlanPrice | null;
  readonly features: ReadonlyArray<PlanFeature>;
  readonly heldForPayment: boolean;
};

/**
 * The billing read (`billing.read`: customer `own` — delegable — and staff
 * `any`), the one procedure a held account must always keep reachable: it is
 * the conversion moment (ADR-0016 Decision 5).
 */
export const makeGetBillingSummary =
  (deps: BillingSubscriptionsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<BillingSummary, BillingSubscriptionsUseCaseError>> => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'billing.read',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const sub = await deps.subscriptions.findByAccount(accountId.value);
    if (!sub) {
      return err(
        subscriptionNotFound(`No subscription for org ${input.accountId}.`),
      );
    }
    const plan = await deps.plans.findPlanById(sub.planId);
    if (!plan) {
      return err(subscriptionNotFound(`No plan for subscription ${sub.id}.`));
    }

    const { limits, features } = resolveEntitlements(plan, sub.overrides);
    const used = await deps.usage.countMembers(sub.accountId);
    const max = limits.maxMembersPerOrg;
    const hold = billingHold({ sub, plan, now, graceDays: deps.graceDays });
    return ok({
      accountId: sub.accountId,
      planId: plan.id,
      planKey: plan.key,
      planName: plan.displayName,
      phase: subscriptionPhase(sub, now),
      trialEndsAt: sub.trialEndsAt,
      paidThroughAt: sub.paidThroughAt,
      seats: { used, max },
      overLimit: max !== null && used > max,
      price: plan.price,
      features,
      heldForPayment: hold.held,
    });
  };

export { makeChangePlan, makeExtendTrial, makeMarkPaid, makeSetOverride };

export type BillingSubscriptionsUseCases = {
  readonly getBillingSummary: ReturnType<typeof makeGetBillingSummary>;
  readonly markPaid: ReturnType<typeof makeMarkPaid>;
  readonly extendTrial: ReturnType<typeof makeExtendTrial>;
  readonly changePlan: ReturnType<typeof makeChangePlan>;
  readonly setOverride: ReturnType<typeof makeSetOverride>;
};

export const makeBillingSubscriptionsUseCases = (
  deps: BillingSubscriptionsDeps,
): BillingSubscriptionsUseCases => ({
  getBillingSummary: makeGetBillingSummary(deps),
  markPaid: makeMarkPaid(deps),
  extendTrial: makeExtendTrial(deps),
  changePlan: makeChangePlan(deps),
  setOverride: makeSetOverride(deps),
});
