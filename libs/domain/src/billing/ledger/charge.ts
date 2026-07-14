/**
 * `createCharge` (ADR-0018 Decision 5) — one period's bill. The amount is the
 * plan price (net subtotal) SNAPSHOTTED here; tax is computed once via
 * `applyTaxBps`; the grace-days policy is snapshotted too. Pure — the id comes
 * from the injected `ids` port, so it stays deterministic.
 */
import { type Result, err, ok } from '@acme/shared';
import { invalidBillingDate, invalidBillingPolicy } from '../errors';
import type { BillingDomainError } from '../errors';
import type { PlanId } from '../plan/plan';
import type { Money } from '../money/money';
import { applyTaxBps } from '../money/tax';
import { isIsoDate } from './dates';
import { makeChargeId, type Charge } from './ledger';

export const createCharge = (
  input: {
    readonly accountId: string;
    readonly planId: PlanId;
    readonly period: { readonly from: string; readonly to: string };
    readonly subtotal: Money;
    readonly taxRateBps: number;
    readonly graceDays: number;
  },
  deps: { readonly ids: () => string },
): Result<Charge, BillingDomainError> => {
  if (!isIsoDate(input.period.from) || !isIsoDate(input.period.to))
    return err(invalidBillingDate('Charge period must be ISO dates.'));
  if (!Number.isSafeInteger(input.graceDays) || input.graceDays < 0)
    return err(
      invalidBillingPolicy('graceDays must be a non-negative integer.'),
    );

  const taxed = applyTaxBps(input.subtotal, input.taxRateBps);
  if (!taxed.ok) return taxed;
  const id = makeChargeId(deps.ids());
  if (!id.ok) return id;

  return ok({
    id: id.value,
    accountId: input.accountId,
    planId: input.planId,
    period: input.period,
    dueDate: input.period.from,
    subtotal: taxed.value.subtotal,
    taxRateBps: input.taxRateBps,
    tax: taxed.value.tax,
    total: taxed.value.total,
    graceDays: input.graceDays,
    status: 'open',
    paidAt: null,
    coveredThrough: null,
  });
};
