import type {
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
} from '@acme/application';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type { AccessSessionPolicies } from '@acme/domain';
import type { Sql } from 'postgres';
import { insertAuditEvent, isUuid } from './rows';
import type { SqlLike } from './rows';

/**
 * Runtime session policy in Postgres. `save` commits, in ONE transaction:
 * the new policies (single-row upsert), the audit event, and the immediate
 * shrink of every live session (`least(current, last_seen + idle,
 * created + max)` per account kind). Loosening never extends anything here —
 * longer windows are only gained through later slides.
 */
const shrinkLiveSessions = async (
  tx: SqlLike,
  policies: AccessSessionPolicies,
): Promise<void> => {
  await tx`
    update public.sessions s
    set expires_at = least(
      s.expires_at,
      coalesce(s.last_seen_at, s.created_at) +
        (case a.kind when 'customer'
          then ${policies.customer.idleTtlMs}
          else ${policies.staff.idleTtlMs} end)::bigint * interval '1 millisecond',
      s.created_at +
        (case a.kind when 'customer'
          then ${policies.customer.maxLifetimeMs}
          else ${policies.staff.maxLifetimeMs} end)::bigint * interval '1 millisecond'
    )
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.id = s.membership_id and s.status = 'active'
  `;
};

export const createPostgresSessionPolicyStore = (
  sql: Sql,
): AccessSessionPolicyStore => ({
  loadSessionPolicies: async () => {
    const rows = await sql`
      select session_policies from public.access_settings where id = true
    `;
    const row = rows[0];
    return row
      ? (row['session_policies'] as AccessSessionPolicies)
      : ACCESS_SESSION_POLICY_DEFAULTS;
  },

  loadSessionSettings: async () => {
    const rows = await sql`
      select session_policies, version from public.access_settings
      where id = true
    `;
    const row = rows[0];
    return row
      ? {
          policies: row['session_policies'] as AccessSessionPolicies,
          version: row['version'] as number,
        }
      : { policies: ACCESS_SESSION_POLICY_DEFAULTS, version: 1 };
  },

  saveSessionPolicies: async (policies, event, expectedVersion) =>
    await sql.begin(async (tx) => {
      const saved = await tx`
        insert into public.access_settings
          (id, session_policies, updated_at, version)
        values (true, ${tx.json(policies as never)}, ${event.occurredAt},
          ${expectedVersion + 1})
        on conflict (id) do update
          set session_policies = excluded.session_policies,
              updated_at = excluded.updated_at,
              version = excluded.version
          where public.access_settings.version = ${expectedVersion}
        returning version
      `;
      if (saved.length === 0) return false;
      await insertAuditEvent(tx, event);
      await shrinkLiveSessions(tx, policies);
      return true;
    }),
});

export const createPostgresSessionActivityRecorder = (
  sql: Sql,
): AccessSessionActivityRecorder => ({
  recordSessionActivity: async (activity) => {
    if (!isUuid(activity.sessionId)) return;
    // Only living sessions slide — never resurrect a revoked/expired one.
    await sql`
      update public.sessions
      set expires_at = ${activity.expiresAt},
          last_seen_at = ${activity.lastSeenAt},
          last_ip = coalesce(${activity.ipAddress}, last_ip)
      where id = ${activity.sessionId}
        and status = 'active'
        and expires_at > ${activity.lastSeenAt}
    `;
  },
});
