import { type Result, err, ok } from '@acme/shared';
import { makeAccountId } from '@acme/domain';
import type { AccessActor, Charge, CurrencyCode, Payment } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import type { BillingLedgerUseCaseError } from '../errors';
import type { BillingLedgerDeps } from '../ports';

/**
 * A flat, UI-agnostic projection of ONE movement in the org's ledger (ADR-0018).
 * The read use case returns raw minor amounts + a running balance; currency
 * formatting and the human description live at the UI edge (the mapper), so this
 * stays pure and testable. `id` is the underlying charge/payment id — for a
 * `payment` it is exactly the id a void/refund targets.
 */
export type LedgerEntryView = {
  readonly id: string;
  /** ISO — a charge's due date, or the payment's occurrence. */
  readonly date: string;
  readonly kind: 'charge' | 'payment' | 'refund' | 'void' | 'credit';
  /**
   * Signed, in minor units, from the customer-owes perspective: a charge adds
   * (+), a payment/credit pays down (−), a refund/void re-owes (+). The running
   * total therefore converges to the domain's derived balance (sum of open
   * charges) under the FIFO full-settlement model.
   */
  readonly amountMinor: number;
  /** Cumulative owed balance right after this movement, in minor units. */
  readonly runningBalanceMinor: number;
  /** Charges only — the settlement state. */
  readonly chargeStatus?: 'open' | 'paid' | 'void';
  /** Charges only — the tax split, for a "subtotal + IVA" note. */
  readonly subtotalMinor?: number;
  readonly taxMinor?: number;
  /** Charges only — the period this charge bills, for the description. */
  readonly period?: { readonly from: string; readonly to: string };
  /** Corrections (void / refund) carry the mandatory reason. */
  readonly reason?: string;
};

export type AccountLedgerView = {
  readonly entries: readonly LedgerEntryView[];
  readonly currency: CurrencyCode;
};

/** Movement sign (customer-owes perspective): charges add, money-in pays down. */
const signedMinor = (m: Charge | Payment): number => {
  if ('period' in m) return m.total.minor; // charge → +
  return m.kind === 'payment' || m.kind === 'credit'
    ? -m.amount.minor // money in → −
    : m.amount.minor; // refund / void re-owe → +
};

const chargeEntry = (
  c: Charge,
): Omit<LedgerEntryView, 'runningBalanceMinor'> => ({
  id: c.id,
  date: c.dueDate,
  kind: 'charge',
  amountMinor: c.total.minor,
  chargeStatus: c.status,
  subtotalMinor: c.subtotal.minor,
  taxMinor: c.tax.minor,
  period: c.period,
});

const paymentEntry = (
  p: Payment,
): Omit<LedgerEntryView, 'runningBalanceMinor'> => ({
  id: p.id,
  date: p.occurredAt,
  kind: p.kind,
  amountMinor: signedMinor(p),
  reason: p.reason,
});

/**
 * Interleave charges + payments chronologically and carry a running owed
 * balance. Pure — the sign/running-total arithmetic is the whole point, so it is
 * unit-tested directly.
 */
export const projectLedger = (
  charges: readonly Charge[],
  payments: readonly Payment[],
  currency: CurrencyCode,
): AccountLedgerView => {
  const flat = [
    ...charges.map(chargeEntry),
    ...payments.map(paymentEntry),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const entries = flat.map((e) => {
    balance += e.amountMinor;
    return { ...e, runningBalanceMinor: balance };
  });
  return { entries, currency };
};

/**
 * List an org's billing ledger (ADR-0018) — the charges + payments the org-detail
 * Ledger card shows, and the source the void/refund correction menu acts on.
 * Same read gate as coverage (`billing.read` — customer `own`, staff `any`); an
 * org with no ledger yet returns an empty list, never a 404.
 */
export const makeListLedger =
  (deps: BillingLedgerDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<AccountLedgerView, BillingLedgerUseCaseError>> => {
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

    const [charges, payments] = await Promise.all([
      deps.charges.listByAccount(accountId.value),
      deps.payments.listByAccount(accountId.value),
    ]);
    return ok(projectLedger(charges, payments, deps.policy.currency));
  };
