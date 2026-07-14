import { type Result, err, ok } from '@acme/shared';
import {
  addMonths,
  createCharge,
  deriveCoverage,
  makeAccountId,
  money,
} from '@acme/domain';
import type { AccessActor, Charge, Coverage, Subscription } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import { subscriptionNotFound } from '../../billing-subscriptions/errors';
import type { BillingLedgerUseCaseError } from '../errors';
import type { BillingLedgerDeps } from '../ports';

export type GenerateChargesInput = {
  readonly actor: AccessActor;
  readonly accountId: string;
};

/** Next uncovered period start = end of the last paid coverage, or trial end. */
const nextPeriodStart = (
  sub: Subscription,
  charges: readonly Charge[],
): string =>
  charges
    .filter((c) => c.status === 'paid')
    .reduce<
      string | null
    >((latest, c) => (c.coveredThrough && (latest === null || latest < c.coveredThrough) ? c.coveredThrough : latest), null) ??
  sub.trialEndsAt;

/** Bill one anchored period from `from` (free/undecided plans bill nothing). */
const billOnePeriod = async (
  deps: BillingLedgerDeps,
  sub: Subscription,
  from: string,
): Promise<Result<void, BillingLedgerUseCaseError>> => {
  const plan = await deps.plans.findPlanById(sub.planId);
  if (!plan || plan.price === null) return ok(undefined);
  const subtotal = money(plan.price.amountCents, deps.policy.currency);
  if (!subtotal.ok) return err(subtotal.error);
  const months = plan.price.interval === 'year' ? 12 : 1;
  const charge = createCharge(
    {
      accountId: sub.accountId,
      planId: sub.planId,
      period: { from, to: addMonths(from, months) },
      subtotal: subtotal.value,
      taxRateBps: deps.policy.taxRateBps,
      graceDays: deps.policy.graceDays,
    },
    { ids: deps.ids },
  );
  if (!charge.ok) return err(charge.error);
  await deps.charges.saveMany([charge.value]);
  return ok(undefined);
};

/**
 * `generateCharges` (ADR-0018 Decisions 2 & gap 3) — the anchored billing
 * engine. Bills the next due period, but keeps the debt BOUNDED: at most one
 * open charge (no new charge while one is unpaid — the suspended freeze), none
 * after cancel, and none while still covered or in trial. Gated by
 * `plans.manage`. Returns the recomputed coverage.
 */
export const makeGenerateCharges =
  (deps: BillingLedgerDeps) =>
  async (
    input: GenerateChargesInput,
  ): Promise<Result<Coverage, BillingLedgerUseCaseError>> => {
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

    const sub = await deps.subscriptions.findByAccount(accountId.value);
    if (!sub)
      return err(
        subscriptionNotFound(`No subscription for ${accountId.value}.`),
      );

    const charges = await deps.charges.listByAccount(accountId.value);
    const start = nextPeriodStart(sub, charges);
    const shouldBill =
      !charges.some((c) => c.status === 'open') &&
      sub.canceledAt === null &&
      start <= now;
    if (shouldBill) {
      const billed = await billOnePeriod(deps, sub, start);
      if (!billed.ok) return err(billed.error);
    }

    const after = await deps.charges.listByAccount(accountId.value);
    return ok(
      deriveCoverage({
        subscription: sub,
        charges: after,
        currency: deps.policy.currency,
        now,
        policy: { dormantDays: deps.policy.dormantDays },
      }),
    );
  };
