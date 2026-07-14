/**
 * The billing ledger (ADR-0018 Decision 1) — an append-only list of `Charge`s
 * (what we billed, per period) and `Payment`s (money movements). Coverage,
 * balance and phase are DERIVED from it (see coverage.ts), never stored.
 */
import { type Brand, type Result, err, ok } from '@acme/shared';
import { invalidBillingId } from '../errors';
import type { BillingDomainError } from '../errors';
import type { PlanId } from '../plan/plan';
import type { Money } from '../money/money';

export type ChargeId = Brand<string, 'ChargeId'>;
export type PaymentId = Brand<string, 'PaymentId'>;

const makeLedgerId = <T>(raw: string): Result<T, BillingDomainError> => {
  const value = raw.trim();
  return value.length === 0
    ? err(invalidBillingId('Billing ids must not be empty.'))
    : ok(value as T);
};
export const makeChargeId = (
  raw: string,
): Result<ChargeId, BillingDomainError> => makeLedgerId<ChargeId>(raw);
export const makePaymentId = (
  raw: string,
): Result<PaymentId, BillingDomainError> => makeLedgerId<PaymentId>(raw);

export type ChargeStatus = 'open' | 'paid' | 'void';

/** One period's bill. Amount fields are SNAPSHOTS (plan price + tax rate + grace
 *  at generation time) so later policy/price changes never rewrite history. */
export type Charge = {
  readonly id: ChargeId;
  readonly accountId: string;
  readonly planId: PlanId;
  /** The coverage window this charge pays for. */
  readonly period: { readonly from: string; readonly to: string };
  /** When payment is due — the anchor (= period.from). */
  readonly dueDate: string;
  readonly subtotal: Money;
  readonly taxRateBps: number;
  readonly tax: Money;
  readonly total: Money;
  /** Grace days that applied when this charge was created (policy snapshot). */
  readonly graceDays: number;
  readonly status: ChargeStatus;
  /** When it was settled — null until paid (set by settlement). */
  readonly paidAt: string | null;
  /** Effective coverage end once paid = `period.to` + downtime credit — the
   *  fact `deriveCoverage` reads for paid-through. Null until paid. */
  readonly coveredThrough: string | null;
};

/** payment = money in; void = a mistaken payment reversed; refund = money
 *  actually returned; credit = a goodwill balance (ADR-0018 Decisions 3 & 6). */
export type PaymentKind = 'payment' | 'void' | 'refund' | 'credit';

export type Payment = {
  readonly id: PaymentId;
  readonly accountId: string;
  readonly kind: PaymentKind;
  /** Applied FIFO to open charges; a positive amount for payment/credit. */
  readonly amount: Money;
  readonly appliedTo: readonly ChargeId[];
  /** The payment a void/refund reverses. */
  readonly reversalOf?: PaymentId;
  readonly recordedByMembershipId: string;
  /** Mandatory — the manual-billing audit trail. */
  readonly reason: string;
  readonly occurredAt: string;
};
