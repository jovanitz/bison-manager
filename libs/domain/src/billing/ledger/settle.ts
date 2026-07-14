/**
 * Applying payments to charges (ADR-0018 Decisions 3 & 4). `settleCharge`
 * settles ONE charge, crediting the downtime forward (or signalling
 * `beyond-cap` when suspended past the dormant window, so the caller starts a
 * fresh period); `applyPayment` walks the open charges FIFO applying an
 * incoming amount — whole-charge settlement only, leftover → credit. All pure.
 */
import type { Money } from '../money/money';
import { addDays, daysBetween } from './dates';
import type { Charge } from './ledger';

export type BillingPolicy = { readonly dormantDays: number };

/** Whole days without service before `payAt` — 0 if paid within grace. */
export const downtimeDays = (charge: Charge, payAt: string): number => {
  const suspendStart = addDays(charge.dueDate, charge.graceDays);
  return Math.max(0, daysBetween(suspendStart, payAt));
};

export type SettleResult =
  | { readonly kind: 'settled'; readonly charge: Charge }
  | { readonly kind: 'beyond-cap' };

export const settleCharge = (
  charge: Charge,
  payAt: string,
  policy: BillingPolicy,
): SettleResult => {
  const downtime = downtimeDays(charge, payAt);
  if (downtime > policy.dormantDays) return { kind: 'beyond-cap' };
  return {
    kind: 'settled',
    charge: {
      ...charge,
      status: 'paid',
      paidAt: payAt,
      coveredThrough: addDays(charge.period.to, downtime),
    },
  };
};

export type ApplyPaymentResult = {
  readonly settled: readonly Charge[];
  readonly voided: readonly Charge[];
  readonly freshStart: boolean;
  readonly credit: Money;
};

type Acc = {
  readonly funds: number;
  readonly settled: readonly Charge[];
  readonly voided: readonly Charge[];
  readonly freshStart: boolean;
  readonly done: boolean;
};

const applyOne = (
  acc: Acc,
  charge: Charge,
  payAt: string,
  policy: BillingPolicy,
): Acc => {
  if (acc.done) return acc;
  const s = settleCharge(charge, payAt, policy);
  if (s.kind === 'beyond-cap')
    return {
      ...acc,
      voided: [...acc.voided, { ...charge, status: 'void' }],
      freshStart: true,
      done: true,
    };
  if (acc.funds < charge.total.minor) return { ...acc, done: true };
  return {
    ...acc,
    funds: acc.funds - charge.total.minor,
    settled: [...acc.settled, s.charge],
  };
};

export const applyPayment = (input: {
  readonly openCharges: readonly Charge[];
  readonly amount: Money;
  readonly payAt: string;
  readonly policy: BillingPolicy;
}): ApplyPaymentResult => {
  const acc = input.openCharges.reduce<Acc>(
    (a, charge) => applyOne(a, charge, input.payAt, input.policy),
    {
      funds: input.amount.minor,
      settled: [],
      voided: [],
      freshStart: false,
      done: false,
    },
  );
  return {
    settled: acc.settled,
    voided: acc.voided,
    freshStart: acc.freshStart,
    credit: { minor: acc.funds, currency: input.amount.currency },
  };
};
