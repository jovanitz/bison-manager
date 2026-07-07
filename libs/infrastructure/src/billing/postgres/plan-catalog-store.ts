import type { PlanCatalogStore } from '@acme/application';
import { DEFAULT_PLANS } from '@acme/domain';
import type { Plan, PlanEntitlements } from '@acme/domain';
import type { Sql, TransactionSql } from 'postgres';
import { isUuid, isoOf } from '../../access/postgres/rows';
import { insertBillingEvent, planFromRow } from './rows';

/**
 * Postgres {@link PlanCatalogStore} (ADR-0016) — same contract as the
 * in-memory adapter. Writes are CAS-guarded (`version`) and commit their
 * billing event in the same transaction; `unique(key)` decides create races.
 */
const insertPlan = async (tx: TransactionSql, plan: Plan): Promise<boolean> => {
  const rows = await tx`
    insert into public.plans
      (id, key, display_name, internal_note, status, visibility, is_default,
       entitlements, trial_months, price, price_set_at, version)
    values (${plan.id}, ${plan.key}, ${plan.displayName}, ${plan.internalNote},
      ${plan.status}, ${plan.visibility}, ${plan.isDefaultForNewOrgs},
      ${tx.json(plan.entitlements as never)}, ${plan.trialMonths},
      ${plan.price === null ? null : tx.json(plan.price as never)},
      ${plan.priceSetAt}, ${plan.version})
    on conflict (key) do nothing
    returning id
  `;
  return rows.length > 0;
};

/** CAS: persists iff the stored version equals what the staff saw. `key` and
 * the default marker are deliberately not writable here (see setDefaultPlan). */
const updatePlanRow = async (
  tx: TransactionSql,
  plan: Plan,
  expectedVersion: number,
): Promise<boolean> => {
  const rows = await tx`
    update public.plans set
      display_name = ${plan.displayName},
      internal_note = ${plan.internalNote},
      status = ${plan.status},
      visibility = ${plan.visibility},
      entitlements = ${tx.json(plan.entitlements as never)},
      trial_months = ${plan.trialMonths},
      price = ${plan.price === null ? null : tx.json(plan.price as never)},
      price_set_at = ${plan.priceSetAt},
      version = ${plan.version}
    where id = ${plan.id} and version = ${expectedVersion}
    returning id
  `;
  return rows.length > 0;
};

/** Member count of every org subscribed to the plan (previewImpact input). */
const readSubscriberMemberCounts = async (
  sql: Sql,
  planId: string,
): Promise<ReadonlyArray<number>> => {
  const rows = await sql`
    select count(m.id)::int as members
    from public.subscriptions s
    left join public.memberships m on m.account_id = s.account_id
    where s.plan_id = ${planId}
    group by s.id
  `;
  return rows.map((row) => row['members'] as number);
};

// v1 approximation (documented in the port): per-org feature usage is not
// tracked, so losing any feature counts EVERY subscriber; over-limit joins
// the CURRENT member count of each subscribed account.
const previewPlanImpact = async (
  sql: Sql,
  planId: string,
  next: PlanEntitlements,
): Promise<{ wouldGoOverLimit: number; wouldLoseFeature: number }> => {
  if (!isUuid(planId)) return { wouldGoOverLimit: 0, wouldLoseFeature: 0 };
  const current = await sql`
    select entitlements from public.plans where id = ${planId}
  `;
  const features =
    (current[0]?.['entitlements'] as PlanEntitlements | undefined)?.features ??
    [];
  const losesFeature = features.some((f) => !next.features.includes(f));
  const counts = await readSubscriberMemberCounts(sql, planId);
  const max = next.limits.maxMembersPerOrg;
  return {
    wouldGoOverLimit:
      max === null ? 0 : counts.filter((members) => members > max).length,
    wouldLoseFeature: losesFeature ? counts.length : 0,
  };
};

const listPlanSubscribers = async (sql: Sql, planId: string) => {
  if (!isUuid(planId)) return [];
  const rows = await sql`
    select account_id, started_at from public.subscriptions
    where plan_id = ${planId} order by started_at asc
  `;
  return rows.map((row) => ({
    accountId: row['account_id'] as string,
    since: isoOf(row['started_at'] as Date),
  }));
};

export const createPostgresPlanCatalogStore = (sql: Sql): PlanCatalogStore => ({
  listPlans: async () =>
    (await sql`select * from public.plans order by key asc`).map(planFromRow),

  findPlanById: async (planId) => {
    if (!isUuid(planId)) return null;
    const rows = await sql`select * from public.plans where id = ${planId}`;
    return rows[0] ? planFromRow(rows[0]) : null;
  },

  findPlanByKey: async (key) => {
    const rows = await sql`
      select * from public.plans where key = ${key} limit 1
    `;
    return rows[0] ? planFromRow(rows[0]) : null;
  },

  findDefaultPlan: async () => {
    const rows = await sql`
      select * from public.plans where is_default limit 1
    `;
    return rows[0] ? planFromRow(rows[0]) : null;
  },

  countSubscribers: async (planId) => {
    if (!isUuid(planId)) return 0;
    const rows = await sql`
      select count(*)::int as n from public.subscriptions
      where plan_id = ${planId}
    `;
    return (rows[0]?.['n'] as number) ?? 0;
  },

  listSubscribers: (planId) => listPlanSubscribers(sql, planId),

  previewImpact: (planId, next) => previewPlanImpact(sql, planId, next),

  savePlan: (plan, expectedVersion, event) =>
    sql.begin(async (tx) => {
      const written =
        expectedVersion === null
          ? await insertPlan(tx, plan)
          : await updatePlanRow(tx, plan, expectedVersion);
      if (!written) return 'conflict' as const;
      await insertBillingEvent(tx, event);
      return 'ok' as const;
    }) as Promise<'ok' | 'conflict'>,

  setDefaultPlan: async (planId, event) => {
    await sql.begin(async (tx) => {
      // clear-then-set inside one transaction keeps the partial unique index
      // (plans_single_default_idx) satisfied at every statement boundary.
      await tx`
        update public.plans set is_default = false
        where is_default and id <> ${planId}
      `;
      await tx`update public.plans set is_default = true where id = ${planId}`;
      await insertBillingEvent(tx, event);
    });
  },
});

/**
 * Idempotent code-floor seeding — the migration's `on conflict (key) do
 * nothing` insert, generated from `DEFAULT_PLANS` so tests and dev resets
 * can never drift from the domain seed values.
 */
export const seedDefaultBillingPlans = async (sql: Sql): Promise<void> => {
  for (const seed of DEFAULT_PLANS) {
    await sql`
      insert into public.plans
        (key, display_name, internal_note, status, visibility, is_default,
         entitlements, trial_months, price, price_set_at, version)
      values (${seed.key}, ${seed.displayName}, ${seed.internalNote}, 'active',
        ${seed.visibility}, ${seed.isDefaultForNewOrgs},
        ${sql.json(seed.entitlements as never)}, ${seed.trialMonths},
        ${seed.price === null ? null : sql.json(seed.price as never)},
        ${seed.price === null ? null : new Date().toISOString()}, 1)
      on conflict (key) do nothing
    `;
  }
};
