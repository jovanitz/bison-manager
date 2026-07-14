import type { ChargeStore } from '@acme/application';
import type { Charge } from '@acme/domain';
import type { Sql, TransactionSql } from 'postgres';
import { isUuid } from '../../access/postgres/rows';
import { chargeFromRow } from './rows';

/**
 * Postgres {@link ChargeStore} (ADR-0018) — same contract as the in-memory
 * adapter. `saveMany` upserts by id: a new charge inserts; a settled one
 * rewrites only the mutable facts (status / paid_at / covered_through) — the
 * snapshotted amounts are immutable. All charges of a batch commit in one
 * transaction.
 */
const upsertCharge = async (tx: TransactionSql, c: Charge): Promise<void> => {
  await tx`
    insert into public.charges
      (id, account_id, plan_id, period_from, period_to, due_date,
       subtotal_minor, tax_rate_bps, tax_minor, total_minor, currency,
       grace_days, status, paid_at, covered_through)
    values (${c.id}, ${c.accountId}, ${c.planId}, ${c.period.from},
      ${c.period.to}, ${c.dueDate}, ${c.subtotal.minor}, ${c.taxRateBps},
      ${c.tax.minor}, ${c.total.minor}, ${c.subtotal.currency}, ${c.graceDays},
      ${c.status}, ${c.paidAt}, ${c.coveredThrough})
    on conflict (id) do update set
      status = excluded.status,
      paid_at = excluded.paid_at,
      covered_through = excluded.covered_through
  `;
};

export const createPostgresChargeStore = (sql: Sql): ChargeStore => ({
  listByAccount: async (accountId) => {
    if (!isUuid(accountId)) return [];
    const rows = await sql`
      select * from public.charges
      where account_id = ${accountId} order by due_date asc
    `;
    return rows.map(chargeFromRow);
  },

  saveMany: async (charges) => {
    if (charges.length === 0) return;
    await sql.begin(async (tx) => {
      for (const charge of charges) {
        await upsertCharge(tx, charge);
      }
    });
  },
});
