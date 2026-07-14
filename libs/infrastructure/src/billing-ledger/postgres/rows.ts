import type {
  Charge,
  ChargeId,
  CurrencyCode,
  Money,
  Payment,
  PaymentId,
  PaymentKind,
  PlanId,
} from '@acme/domain';
import type { Row } from 'postgres';
import { isoOf, isoOrNull } from '../../access/postgres/rows';

/**
 * Row ↔ domain mapping for the billing-ledger tables (ADR-0018) — the access
 * `rows.ts` idiom. Postgres returns timestamptz as Date and bigint as string;
 * the domain speaks ISO strings + integer minor units, so money is rebuilt from
 * `<x>_minor` + the row currency.
 */
const money = (minor: unknown, currency: unknown): Money => ({
  minor: Number(minor),
  currency: currency as CurrencyCode,
});

export const chargeFromRow = (row: Row): Charge => ({
  id: row['id'] as ChargeId,
  accountId: row['account_id'] as string,
  planId: row['plan_id'] as PlanId,
  period: {
    from: isoOf(row['period_from'] as Date),
    to: isoOf(row['period_to'] as Date),
  },
  dueDate: isoOf(row['due_date'] as Date),
  subtotal: money(row['subtotal_minor'], row['currency']),
  taxRateBps: Number(row['tax_rate_bps']),
  tax: money(row['tax_minor'], row['currency']),
  total: money(row['total_minor'], row['currency']),
  graceDays: Number(row['grace_days']),
  status: row['status'] as Charge['status'],
  paidAt: isoOrNull(row['paid_at'] as Date | null),
  coveredThrough: isoOrNull(row['covered_through'] as Date | null),
});

export const paymentFromRow = (row: Row): Payment => {
  const base: Payment = {
    id: row['id'] as PaymentId,
    accountId: row['account_id'] as string,
    kind: row['kind'] as PaymentKind,
    amount: money(row['amount_minor'], row['currency']),
    appliedTo: (row['applied_to'] as readonly string[]).map(
      (id) => id as ChargeId,
    ),
    recordedByMembershipId: row['recorded_by_membership_id'] as string,
    reason: row['reason'] as string,
    occurredAt: isoOf(row['occurred_at'] as Date),
  };
  const reversalOf = row['reversal_of'] as string | null;
  return reversalOf ? { ...base, reversalOf: reversalOf as PaymentId } : base;
};
