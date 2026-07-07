import postgres from 'postgres';
import type { Sql } from 'postgres';
import type { Plan, Subscription } from '@acme/domain';
import { applyPostgresAccessSeed } from './postgres-access-seed';
import type { BillingContractSeed } from './billing/billing-store-fixtures';

/**
 * Test/dev plumbing: load a billing contract seed into the Postgres schema so
 * both billing stores run the same contract suite. The access world
 * (accounts/memberships/users) goes through `applyPostgresAccessSeed` — its
 * wipe cascades over subscriptions too — then the billing tables are wiped
 * and re-inserted. Local/test databases only, never production.
 */
const insertPlanRow = async (sql: Sql, plan: Plan): Promise<void> => {
  await sql`
    insert into public.plans
      (id, key, display_name, internal_note, status, visibility, is_default,
       entitlements, trial_months, price, price_set_at, version)
    values (${plan.id}, ${plan.key}, ${plan.displayName}, ${plan.internalNote},
      ${plan.status}, ${plan.visibility}, ${plan.isDefaultForNewOrgs},
      ${sql.json(plan.entitlements as never)}, ${plan.trialMonths},
      ${plan.price === null ? null : sql.json(plan.price as never)},
      ${plan.priceSetAt}, ${plan.version})
  `;
};

const insertSubscriptionRow = async (
  sql: Sql,
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

export const applyPostgresBillingSeed = async (
  databaseUrl: string,
  seed: BillingContractSeed,
): Promise<void> => {
  await applyPostgresAccessSeed(databaseUrl, seed.access);
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    // plans cascades over subscriptions; billing_events' append-only trigger
    // is row-level, so truncate passes (test plumbing, not a client write).
    await sql`truncate public.plans restart identity cascade`;
    await sql`truncate public.billing_events restart identity`;
    for (const plan of seed.billing.plans ?? []) {
      await insertPlanRow(sql, plan);
    }
    for (const sub of seed.billing.subscriptions ?? []) {
      await insertSubscriptionRow(sql, sub);
    }
  } finally {
    await sql.end();
  }
};
