/**
 * `Money` value object (ADR-0018 Decision 2). An integer amount in the
 * currency's SMALLEST unit + its currency — never a float, never a decimal
 * string (`0.1 + 0.2` / `parseFloat("49.99") * 100` are the bug class this
 * forbids). `number` is exact for integers below 2^53, so no bigint/decimal lib.
 * Multi-country is designed in: the minor-unit exponent is a property of the
 * currency (never a hardcoded ×100), used only at the parse/format edges.
 */
import { type Result, err, ok } from '@acme/shared';
import { currencyMismatch, invalidMoney } from '../errors';
import type { BillingDomainError } from '../errors';

/** Widen this union to go multi-country; each addition forces its `CURRENCY`
 *  entry (exponent + symbol), so the compiler guides the expansion. */
export type CurrencyCode = 'MXN';

/** ISO 4217 minor-unit exponents — 2 for MXN/USD, 0 for JPY/CLP, 3 for KWD. */
export const CURRENCY: Record<
  CurrencyCode,
  { readonly exponent: number; readonly symbol: string }
> = {
  MXN: { exponent: 2, symbol: '$' },
};

/** An amount in a currency's smallest unit (integer minor units). */
export type Money = { readonly minor: number; readonly currency: CurrencyCode };

export const money = (
  minor: number,
  currency: CurrencyCode,
): Result<Money, BillingDomainError> =>
  Number.isSafeInteger(minor)
    ? ok({ minor, currency })
    : err(
        invalidMoney(`Money must be an integer of minor units, got ${minor}.`),
      );

export const zeroMoney = (currency: CurrencyCode): Money => ({
  minor: 0,
  currency,
});

export const isZero = (m: Money): boolean => m.minor === 0;
export const isNegative = (m: Money): boolean => m.minor < 0;

const sameCurrency = (
  a: Money,
  b: Money,
): Result<CurrencyCode, BillingDomainError> =>
  a.currency === b.currency
    ? ok(a.currency)
    : err(currencyMismatch(`Cannot combine ${a.currency} and ${b.currency}.`));

export const addMoney = (
  a: Money,
  b: Money,
): Result<Money, BillingDomainError> => {
  const c = sameCurrency(a, b);
  return c.ok ? money(a.minor + b.minor, c.value) : c;
};

export const subtractMoney = (
  a: Money,
  b: Money,
): Result<Money, BillingDomainError> => {
  const c = sameCurrency(a, b);
  return c.ok ? money(a.minor - b.minor, c.value) : c;
};

/** −1 | 0 | 1, only meaningful within one currency (Result guards the mix). */
export const compareMoney = (
  a: Money,
  b: Money,
): Result<number, BillingDomainError> => {
  const c = sameCurrency(a, b);
  return c.ok ? ok(Math.sign(a.minor - b.minor)) : c;
};

/**
 * Parse a decimal string ("49.99") into `Money` WITHOUT floats — split on the
 * point and scale by the currency's exponent. Edge helper for adapter/UI input;
 * lives here because the float-free logic is the whole point.
 */
export const parseMoney = (
  input: string,
  currency: CurrencyCode,
): Result<Money, BillingDomainError> => {
  const { exponent } = CURRENCY[currency];
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) return err(invalidMoney(`"${input}" is not a decimal amount.`));
  const [, sign, whole, frac = ''] = match;
  if (frac.length > exponent)
    return err(
      invalidMoney(`${currency} allows at most ${exponent} decimals.`),
    );
  const minor = Number(`${whole}${frac.padEnd(exponent, '0')}`);
  return money(sign === '-' ? -minor : minor, currency);
};
