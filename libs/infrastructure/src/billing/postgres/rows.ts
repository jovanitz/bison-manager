import type {
  BillingEvent,
  Plan,
  PlanEntitlements,
  PlanId,
  PlanPrice,
  Subscription,
  SubscriptionId,
} from '@acme/domain';
import type { Row } from 'postgres';
import { isoOf, isoOrNull } from '../../access/postgres/rows';
import type { SqlLike } from '../../access/postgres/rows';

/**
 * Row ↔ domain mapping for the billing tables (ADR-0016), shared by every
 * Postgres billing adapter — the access `rows.ts` idiom. Postgres returns
 * timestamptz as Date and jsonb parsed; domain speaks ISO strings.
 */
export const planFromRow = (row: Row): Plan => ({
  id: row['id'] as PlanId,
  key: row['key'] as string,
  displayName: row['display_name'] as string,
  internalNote: row['internal_note'] as string,
  status: row['status'] as Plan['status'],
  visibility: row['visibility'] as Plan['visibility'],
  isDefaultForNewOrgs: row['is_default'] as boolean,
  entitlements: row['entitlements'] as PlanEntitlements,
  trialMonths: row['trial_months'] as number,
  price: (row['price'] as PlanPrice | null) ?? null,
  priceSetAt: isoOrNull(row['price_set_at'] as Date | null),
  version: row['version'] as number,
});

export const subscriptionFromRow = (row: Row): Subscription => ({
  id: row['id'] as SubscriptionId,
  accountId: row['account_id'] as string,
  planId: row['plan_id'] as PlanId,
  createdByUserId: row['created_by_user_id'] as string,
  startedAt: isoOf(row['started_at'] as Date),
  trialEndsAt: isoOf(row['trial_ends_at'] as Date),
  paidThroughAt: isoOrNull(row['paid_through_at'] as Date | null),
  canceledAt: isoOrNull(row['canceled_at'] as Date | null),
  overrides: (row['overrides'] as Subscription['overrides']) ?? null,
});

/**
 * The one way a billing event reaches the table — billing's OWN audit stream,
 * never the access `audit_events` union. Callers pass their transaction
 * handle so mutation + event commit or roll back together.
 */
export const insertBillingEvent = async (
  sql: SqlLike,
  event: BillingEvent,
): Promise<void> => {
  await sql`
    insert into public.billing_events (type, payload, occurred_at)
    values (${event.type}, ${sql.json(event as never)}, ${event.occurredAt})
  `;
};

/**
 * Birth insert (never an upsert): used by the identity onboarding adapter so
 * org + membership + subscription commit in ONE transaction (ADR-0016
 * Decision 2). Callers pass their transaction handle.
 */
export const insertSubscriptionRow = async (
  sql: SqlLike,
  sub: Subscription,
): Promise<void> => {
  await sql`
    insert into public.subscriptions
      (id, account_id, plan_id, created_by_user_id, started_at, trial_ends_at,
       paid_through_at, canceled_at, overrides)
    values (${sub.id}, ${sub.accountId}, ${sub.planId},
      ${sub.createdByUserId}, ${sub.startedAt}, ${sub.trialEndsAt},
      ${sub.paidThroughAt}, ${sub.canceledAt},
      ${sub.overrides === null ? null : sql.json(sub.overrides as never)})
  `;
};
