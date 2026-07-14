/**
 * `deriveCoverage` (ADR-0018 Decisions 1, 3, 4) — the read model. From the
 * ledger (charges, with settlement facts) + the subscription facts + a clock,
 * derive `paidThroughAt`, the outstanding `balance`, the product-visible
 * `phase`, and the `dormant` triage flag. Nothing here is stored — the card and
 * the ledger are two views of this one computation, so they cannot disagree.
 */
import type { CurrencyCode, Money } from '../money/money';
import type { Subscription } from '../subscription/subscription';
import { addDays, daysBetween, isBefore } from './dates';
import type { Charge } from './ledger';
import type { BillingPolicy } from './settle';

export type BillingPhase =
  | 'trialing'
  | 'active'
  | 'grace'
  | 'suspended'
  | 'canceled';

export type Coverage = {
  readonly paidThroughAt: string | null;
  readonly balance: Money;
  readonly phase: BillingPhase;
  readonly dormant: boolean;
};

const latestCoveredThrough = (charges: readonly Charge[]): string | null =>
  charges.reduce<string | null>(
    (latest, c) =>
      c.coveredThrough &&
      (latest === null || isBefore(latest, c.coveredThrough))
        ? c.coveredThrough
        : latest,
    null,
  );

const derivePhase = (input: {
  readonly sub: Subscription;
  readonly now: string;
  readonly covered: boolean;
  readonly suspendStart: string | null;
}): BillingPhase => {
  const { sub, now, covered, suspendStart } = input;
  if (sub.canceledAt !== null) return covered ? 'active' : 'canceled';
  if (isBefore(now, sub.trialEndsAt)) return 'trialing';
  if (covered) return 'active';
  if (suspendStart === null || isBefore(now, suspendStart)) return 'grace';
  return 'suspended';
};

export const deriveCoverage = (input: {
  readonly subscription: Subscription;
  readonly charges: readonly Charge[];
  readonly currency: CurrencyCode;
  readonly now: string;
  readonly policy: BillingPolicy;
}): Coverage => {
  const { subscription: sub, charges, currency, now, policy } = input;

  const open = charges
    .filter((c) => c.status === 'open')
    .sort((a, b) => (isBefore(a.dueDate, b.dueDate) ? -1 : 1));
  const paidThroughAt = latestCoveredThrough(
    charges.filter((c) => c.status === 'paid'),
  );

  const balance: Money = {
    minor: open.reduce((sum, c) => sum + c.total.minor, 0),
    currency,
  };

  const oldest = open[0];
  const suspendStart = oldest
    ? addDays(oldest.dueDate, oldest.graceDays)
    : null;
  const covered = paidThroughAt !== null && isBefore(now, paidThroughAt);
  const phase = derivePhase({ sub, now, covered, suspendStart });

  const dormant =
    phase === 'suspended' &&
    suspendStart !== null &&
    daysBetween(suspendStart, now) > policy.dormantDays;

  return { paidThroughAt, balance, phase, dormant };
};
