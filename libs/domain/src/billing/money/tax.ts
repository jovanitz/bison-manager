/**
 * Tax computation for a charge (ADR-0018 Decision 5) — the one place the
 * "division danger zone" of Money bites. The rate is integer BASIS POINTS
 * (1600 = 16%), the tax is computed ONCE with HALF-UP rounding and stored, and
 * the total is an integer sum. No floats anywhere.
 */
import { type Result, err, ok } from '@acme/shared';
import { invalidTaxRate } from '../errors';
import type { BillingDomainError } from '../errors';
import { addMoney, money, type Money } from './money';

const BPS_DENOMINATOR = 10_000;

/** Round `numerator / denominator` half-up (both non-negative). */
const roundHalfUp = (numerator: number, denominator: number): number =>
  Math.floor((numerator + Math.floor(denominator / 2)) / denominator);

export type TaxedAmount = {
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
};

/** Apply a basis-point tax rate to a net subtotal → { subtotal, tax, total }. */
export const applyTaxBps = (
  subtotal: Money,
  rateBps: number,
): Result<TaxedAmount, BillingDomainError> => {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0)
    return err(
      invalidTaxRate(
        `Tax rate must be non-negative integer bps, got ${rateBps}.`,
      ),
    );
  const taxResult = money(
    roundHalfUp(subtotal.minor * rateBps, BPS_DENOMINATOR),
    subtotal.currency,
  );
  if (!taxResult.ok) return taxResult;
  const total = addMoney(subtotal, taxResult.value);
  return total.ok
    ? ok({ subtotal, tax: taxResult.value, total: total.value })
    : total;
};
