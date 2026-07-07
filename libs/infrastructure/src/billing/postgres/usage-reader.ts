import type { EntitlementUsageReader } from '@acme/application';
import type { Sql } from 'postgres';
import { isUuid } from '../../access/postgres/rows';

/**
 * Postgres {@link EntitlementUsageReader} (ADR-0016) — the native counting
 * variant of the composed `makeEntitlementUsageReader`, contract-tested to
 * behave identically. Counts are computed live in SQL over the REAL
 * memberships/accounts tables (never cached): seat checks read the current
 * member rows; the ownership limit (D2) joins owned memberships to their
 * subscription's plan, filtered per plan key.
 */
export const createPostgresEntitlementUsageReader = (
  sql: Sql,
): EntitlementUsageReader => ({
  countMembers: async (accountId) => {
    if (!isUuid(accountId)) return 0;
    const rows = await sql`
      select count(*)::int as n from public.memberships
      where account_id = ${accountId}
    `;
    return (rows[0]?.['n'] as number) ?? 0;
  },

  countOwnedOrgsOnPlan: async (userId, planKey) => {
    if (!isUuid(userId)) return 0;
    const rows = await sql`
      select count(*)::int as n
      from public.memberships m
      join public.subscriptions s on s.account_id = m.account_id
      join public.plans p on p.id = s.plan_id
      where m.user_id = ${userId} and m.is_account_owner
        and p.key = ${planKey}
    `;
    return (rows[0]?.['n'] as number) ?? 0;
  },
});
