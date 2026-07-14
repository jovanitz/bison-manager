import { type Result, err, ok } from '@acme/shared';
import {
  addMonths,
  applyPayment,
  createCharge,
  deriveCoverage,
  makeAccountId,
  makePaymentId,
  money,
} from '@acme/domain';
import type {
  AccessActor,
  ApplyPaymentResult,
  Charge,
  Coverage,
  Money,
  Payment,
  PlanInterval,
  Subscription,
} from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import { subscriptionNotFound } from '../../billing-subscriptions/errors';
import type { BillingLedgerUseCaseError } from '../errors';
import type { BillingLedgerDeps } from '../ports';

export type RecordPaymentInput = {
  readonly actor: AccessActor;
  readonly accountId: string;
  /** Amount tendered, in the ledger currency's minor units. */
  readonly amountMinor: number;
  readonly payAt: string;
  readonly reason: string;
};

/** Open charges oldest-first — payments settle FIFO (ISO dates sort chronologically). */
const openFifo = (charges: readonly Charge[]): readonly Charge[] =>
  charges
    .filter((c) => c.status === 'open')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

const monthsFor = (interval: PlanInterval): number =>
  interval === 'year' ? 12 : 1;

const buildPayment = (input: {
  readonly ids: () => string;
  readonly accountId: string;
  readonly actor: AccessActor;
  readonly kind: 'payment' | 'credit';
  readonly amount: Money;
  readonly appliedTo: readonly Charge[];
  readonly at: string;
  readonly reason: string;
}): Result<Payment, BillingLedgerUseCaseError> => {
  const id = makePaymentId(input.ids());
  if (!id.ok) return err(id.error);
  return ok({
    id: id.value,
    accountId: input.accountId,
    kind: input.kind,
    amount: input.amount,
    appliedTo: input.appliedTo.map((c) => c.id),
    recordedByMembershipId: input.actor.membership.id,
    reason: input.reason,
    occurredAt: input.at,
  });
};

/** The fresh charge a beyond-cap payment starts (null for free/undecided plans). */
const buildFreshCharge = async (
  deps: BillingLedgerDeps,
  sub: Subscription,
  payAt: string,
): Promise<Result<Charge | null, BillingLedgerUseCaseError>> => {
  const plan = await deps.plans.findPlanById(sub.planId);
  if (!plan || plan.price === null) return ok(null); // free / undecided
  const subtotal = money(plan.price.amountCents, deps.policy.currency);
  if (!subtotal.ok) return err(subtotal.error);
  return createCharge(
    {
      accountId: sub.accountId,
      planId: sub.planId,
      period: {
        from: payAt,
        to: addMonths(payAt, monthsFor(plan.price.interval)),
      },
      subtotal: subtotal.value,
      taxRateBps: deps.policy.taxRateBps,
      graceDays: deps.policy.graceDays,
    },
    { ids: deps.ids },
  );
};

type FreshStart = {
  readonly charges: readonly Charge[];
  readonly settled: readonly Charge[];
};

/** On fresh start: generate the fresh charge and settle it with the leftover
 *  credit (the payment covers the new period), so the org lands `active`. */
const resolveFreshStart = async (
  deps: BillingLedgerDeps,
  sub: Subscription,
  payAt: string,
  applied: ApplyPaymentResult,
): Promise<Result<FreshStart, BillingLedgerUseCaseError>> => {
  if (!applied.freshStart) return ok({ charges: [], settled: [] });
  const fresh = await buildFreshCharge(deps, sub, payAt);
  if (!fresh.ok) return err(fresh.error);
  if (!fresh.value) return ok({ charges: [], settled: [] });
  const settle = applyPayment({
    openCharges: [fresh.value],
    amount: applied.credit,
    payAt,
    policy: { dormantDays: deps.policy.dormantDays },
  });
  const charges = settle.settled.length ? settle.settled : [fresh.value];
  return ok({ charges, settled: settle.settled });
};

type SettleInput = {
  readonly actor: AccessActor;
  readonly accountId: string;
  readonly amountMinor: number;
  readonly at: string;
  readonly reason: string;
  readonly kind: 'payment' | 'credit';
};

/**
 * The shared settlement core (ADR-0018 Decisions 2, 3 & 6). Applies an incoming
 * amount FIFO to open charges (whole-charge, downtime credited forward); beyond
 * the dormant cap it voids the stale charge and starts a fresh period the amount
 * covers. Appends the movement (a real `payment` or a goodwill `credit`),
 * persists the charges, returns the recomputed coverage. Gated by `plans.manage`.
 */
const settle =
  (deps: BillingLedgerDeps) =>
  async (
    input: SettleInput,
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
    const amount = money(input.amountMinor, deps.policy.currency);
    if (!amount.ok) return err(amount.error);

    const charges = await deps.charges.listByAccount(accountId.value);
    const applied = applyPayment({
      openCharges: openFifo(charges),
      amount: amount.value,
      payAt: input.at,
      policy: { dormantDays: deps.policy.dormantDays },
    });
    const fresh = await resolveFreshStart(deps, sub, input.at, applied);
    if (!fresh.ok) return err(fresh.error);
    await deps.charges.saveMany([
      ...applied.settled,
      ...applied.voided,
      ...fresh.value.charges,
    ]);

    const payment = buildPayment({
      ids: deps.ids,
      accountId: accountId.value,
      actor: input.actor,
      kind: input.kind,
      amount: amount.value,
      appliedTo: [...applied.settled, ...fresh.value.settled],
      at: input.at,
      reason: input.reason,
    });
    if (!payment.ok) return err(payment.error);
    await deps.payments.append(payment.value);

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

/** The manual-billing write: staff record a real out-of-band payment (`payAt`). */
export const makeRecordPayment =
  (deps: BillingLedgerDeps) => (input: RecordPaymentInput) =>
    settle(deps)({
      actor: input.actor,
      accountId: input.accountId,
      amountMinor: input.amountMinor,
      at: input.payAt,
      reason: input.reason,
      kind: 'payment',
    });

export type CreditAccountInput = {
  readonly actor: AccessActor;
  readonly accountId: string;
  readonly amountMinor: number;
  readonly reason: string;
};

/** Goodwill credit ("free month") — same settlement, tagged `credit`, applied now. */
export const makeCreditAccount =
  (deps: BillingLedgerDeps) => (input: CreditAccountInput) =>
    settle(deps)({
      actor: input.actor,
      accountId: input.accountId,
      amountMinor: input.amountMinor,
      at: deps.clock.now().toISOString(),
      reason: input.reason,
      kind: 'credit',
    });
