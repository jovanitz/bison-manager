import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  applyPlanChange,
  extendTrial,
  makeAccountId,
  markPaid,
  setOverride,
} from '@acme/domain';
import type { AccessActor, PlanEntitlements, Subscription } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import { planNotFound, reasonRequired } from '../../billing-plans/errors';
import type { PlanCatalogStore } from '../../billing-plans/ports';
import { planRetired, subscriptionNotFound } from '../errors';
import type { BillingSubscriptionsUseCaseError } from '../errors';
import type { EntitlementUsageReader, SubscriptionStore } from '../ports';

/**
 * The staff manual levers (ADR-0016 Decision 5) — the bridge until payments
 * exist. All setters are ABSOLUTE ("paid through DATE"), idempotent under
 * retries, and demand a non-empty `reason` (the impersonation-grant
 * precedent): during the manual-billing era the audit trail IS the accounting.
 */
export type BillingSubscriptionsDeps = {
  readonly subscriptions: SubscriptionStore;
  readonly plans: Pick<PlanCatalogStore, 'findPlanById'>;
  readonly usage: EntitlementUsageReader;
  readonly clock: Clock;
  /** Delinquency grace window for the summary's `heldForPayment`. */
  readonly graceDays: number;
};

type LeverResult = Promise<Result<void, BillingSubscriptionsUseCaseError>>;

type LeverContext = {
  readonly sub: Subscription;
  readonly reason: string;
  readonly now: string;
};

/** Shared head of every lever: parse, authorize `plans.manage`, demand a
 * reason, load the target subscription (fail closed when absent). */
const loadLeverTarget = async (
  deps: BillingSubscriptionsDeps,
  input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly reason: string;
  },
): Promise<Result<LeverContext, BillingSubscriptionsUseCaseError>> => {
  const accountId = makeAccountId(input.accountId);
  if (!accountId.ok) return err(accountId.error);
  const now = deps.clock.now().toISOString();

  const authorized = authorizeAccessAction({
    actor: input.actor,
    action: 'plans.manage',
    resource: { accountId: accountId.value },
    now,
  });
  if (!authorized.ok) return err(authorized.error);

  const reason = input.reason.trim();
  if (reason.length === 0) {
    return err(reasonRequired('Staff billing levers require a reason.'));
  }

  const sub = await deps.subscriptions.findByAccount(accountId.value);
  if (!sub) {
    return err(
      subscriptionNotFound(`No subscription for org ${input.accountId}.`),
    );
  }
  return ok({ sub, reason, now });
};

/** "Paid through DATE" — the manual-era substitute for a payment webhook. */
export const makeMarkPaid =
  (deps: BillingSubscriptionsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly paidThrough: string;
    readonly reason: string;
    readonly amountNote?: string;
  }): LeverResult => {
    const loaded = await loadLeverTarget(deps, input);
    if (!loaded.ok) return err(loaded.error);
    const { sub, reason, now } = loaded.value;
    const updated = markPaid(sub, input.paidThrough);
    if (!updated.ok) return err(updated.error);

    await deps.subscriptions.save(updated.value, {
      type: 'subscription.paid-marked',
      subscriptionId: sub.id,
      accountId: sub.accountId,
      paidThroughAt: input.paidThrough,
      amountNote: input.amountNote?.trim() || null,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    return ok(undefined);
  };

/** "Trial ends DATE" — the ONLY way a new trial is ever granted. */
export const makeExtendTrial =
  (deps: BillingSubscriptionsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly trialEndsAt: string;
    readonly reason: string;
  }): LeverResult => {
    const loaded = await loadLeverTarget(deps, input);
    if (!loaded.ok) return err(loaded.error);
    const { sub, reason, now } = loaded.value;
    const updated = extendTrial(sub, input.trialEndsAt);
    if (!updated.ok) return err(updated.error);

    await deps.subscriptions.save(updated.value, {
      type: 'subscription.trial-extended',
      subscriptionId: sub.id,
      accountId: sub.accountId,
      trialEndsAt: input.trialEndsAt,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    return ok(undefined);
  };

/**
 * Staff-only plan swap. Retired plans are frozen — closed to ALL new
 * subscriptions, even staff; hidden+active IS assignable (the home of
 * legacy/custom plans). Never regrants a trial (`applyPlanChange`).
 */
export const makeChangePlan =
  (deps: BillingSubscriptionsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly planId: string;
    readonly reason: string;
  }): LeverResult => {
    const loaded = await loadLeverTarget(deps, input);
    if (!loaded.ok) return err(loaded.error);
    const { sub, reason, now } = loaded.value;
    const target = await deps.plans.findPlanById(input.planId);
    if (!target) return err(planNotFound(`No plan ${input.planId}.`));
    if (target.status === 'retired') {
      return err(
        planRetired(`Plan "${target.key}" is retired and not assignable.`),
      );
    }

    const updated = applyPlanChange(sub, target.id);
    await deps.subscriptions.save(updated, {
      type: 'subscription.plan-changed',
      subscriptionId: sub.id,
      accountId: sub.accountId,
      fromPlanId: sub.planId,
      toPlanId: target.id,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    return ok(undefined);
  };

/** The per-org exception valve: one override, not a new plan. */
export const makeSetOverride =
  (deps: BillingSubscriptionsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly overrides: Partial<PlanEntitlements> | null;
    readonly reason: string;
  }): LeverResult => {
    const loaded = await loadLeverTarget(deps, input);
    if (!loaded.ok) return err(loaded.error);
    const { sub, reason, now } = loaded.value;
    const updated = setOverride(sub, input.overrides);

    await deps.subscriptions.save(updated, {
      type: 'subscription.override-set',
      subscriptionId: sub.id,
      accountId: sub.accountId,
      before: sub.overrides,
      after: updated.overrides,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    return ok(undefined);
  };
