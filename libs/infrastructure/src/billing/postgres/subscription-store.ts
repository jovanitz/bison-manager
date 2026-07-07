import type { SubscriptionStore } from '@acme/application';
import type { Subscription } from '@acme/domain';
import type { Sql, TransactionSql } from 'postgres';
import { isUuid } from '../../access/postgres/rows';
import { insertBillingEvent, subscriptionFromRow } from './rows';

/**
 * Postgres {@link SubscriptionStore} (ADR-0016) — same contract as the
 * in-memory adapter. `unique(account_id)` keys the upsert: the birth facts
 * (id, creating identity, startedAt) are written once and immutable; the
 * staff levers replace only the mutable facts. Every write commits its
 * billing event in the same transaction, and the trial-expiry recording is
 * CAS-guarded (`trial_expiry_recorded_at is null`) so concurrent observers
 * emit ONE event, not N (the `grant.expired` precedent).
 */
const upsertSubscription = async (
  tx: TransactionSql,
  sub: Subscription,
): Promise<void> => {
  await tx`
    insert into public.subscriptions
      (id, account_id, plan_id, created_by_user_id, started_at, trial_ends_at,
       paid_through_at, canceled_at, overrides)
    values (${sub.id}, ${sub.accountId}, ${sub.planId},
      ${sub.createdByUserId}, ${sub.startedAt}, ${sub.trialEndsAt},
      ${sub.paidThroughAt}, ${sub.canceledAt},
      ${sub.overrides === null ? null : tx.json(sub.overrides as never)})
    on conflict (account_id) do update set
      plan_id = excluded.plan_id,
      trial_ends_at = excluded.trial_ends_at,
      paid_through_at = excluded.paid_through_at,
      canceled_at = excluded.canceled_at,
      overrides = excluded.overrides
  `;
};

export const createPostgresSubscriptionStore = (
  sql: Sql,
): SubscriptionStore => ({
  findByAccount: async (accountId) => {
    if (!isUuid(accountId)) return null;
    const rows = await sql`
      select * from public.subscriptions where account_id = ${accountId}
    `;
    return rows[0] ? subscriptionFromRow(rows[0]) : null;
  },

  save: async (sub, event) => {
    await sql.begin(async (tx) => {
      await upsertSubscription(tx, sub);
      await insertBillingEvent(tx, event);
    });
  },

  hasTrialConsumedByUser: async (userId) => {
    if (!isUuid(userId)) return false;
    const rows = await sql`
      select 1 as one from public.subscriptions
      where created_by_user_id = ${userId} limit 1
    `;
    return rows.length > 0;
  },

  recordTrialExpired: async (subscriptionId, event) => {
    if (!isUuid(subscriptionId)) return false;
    return sql.begin(async (tx) => {
      const rows = await tx`
        update public.subscriptions
        set trial_expiry_recorded_at = ${event.occurredAt}
        where id = ${subscriptionId} and trial_expiry_recorded_at is null
        returning id
      `;
      if (rows.length === 0) return false;
      await insertBillingEvent(tx, event);
      return true;
    }) as Promise<boolean>;
  },
});
