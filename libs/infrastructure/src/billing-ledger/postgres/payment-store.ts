import type { PaymentStore } from '@acme/application';
import type { Payment } from '@acme/domain';
import type { Sql } from 'postgres';
import { isUuid } from '../../access/postgres/rows';
import { paymentFromRow } from './rows';

/**
 * Postgres {@link PaymentStore} (ADR-0018) — append-only (the table's trigger
 * refuses update/delete; corrections are compensating rows). `applied_to` maps
 * to the uuid[] column; `reversal_of` links a void/refund to its original.
 */
export const createPostgresPaymentStore = (sql: Sql): PaymentStore => ({
  listByAccount: async (accountId) => {
    if (!isUuid(accountId)) return [];
    const rows = await sql`
      select * from public.payments
      where account_id = ${accountId} order by occurred_at asc
    `;
    return rows.map(paymentFromRow);
  },

  findById: async (paymentId) => {
    if (!isUuid(paymentId)) return null;
    const rows =
      await sql`select * from public.payments where id = ${paymentId}`;
    return rows[0] ? paymentFromRow(rows[0]) : null;
  },

  append: async (p: Payment) => {
    await sql`
      insert into public.payments
        (id, account_id, kind, amount_minor, currency, applied_to, reversal_of,
         recorded_by_membership_id, reason, occurred_at)
      values (${p.id}, ${p.accountId}, ${p.kind}, ${p.amount.minor},
        ${p.amount.currency}, ${[...p.appliedTo]}::uuid[], ${p.reversalOf ?? null},
        ${p.recordedByMembershipId}, ${p.reason}, ${p.occurredAt})
    `;
  },
});
