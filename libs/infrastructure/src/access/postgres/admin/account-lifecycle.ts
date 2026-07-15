import type { Sql } from 'postgres';
import type {
  AccessAccountDemoted,
  AccessAccountDisabled,
  AccessAccountEnabled,
  AccessAccountPromoted,
  AccessSessionPolicy,
  AccountId,
} from '@acme/domain';
import { insertAuditEvent } from '../rows';

/** Account-lifecycle mutations: promote/demote across the customer↔staff line,
 *  and disable/enable — each one audited in the same transaction. */
export const promoteAccountToStaff = async (
  sql: Sql,
  id: AccountId,
  event: AccessAccountPromoted,
  staffPolicy: AccessSessionPolicy,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`
      update public.accounts set kind = 'staff' where id = ${id}
    `;
    await tx`
      update public.sessions s
      set expires_at = least(
        s.expires_at,
        coalesce(s.last_seen_at, s.created_at) +
          ${staffPolicy.idleTtlMs}::bigint * interval '1 millisecond',
        s.created_at +
          ${staffPolicy.maxLifetimeMs}::bigint * interval '1 millisecond'
      )
      from public.memberships m
      where m.id = s.membership_id
        and m.account_id = ${id}
        and s.status = 'active'
    `;
    await insertAuditEvent(tx, event);
  });
};

/**
 * The inverse of promotion. Flips kind back to customer, RESETS every
 * membership's roles (staff-grade permissions must not survive on a customer
 * account), and re-binds live sessions under the customer policy — all in one
 * transaction with the audit event.
 */
export const demoteAccountToCustomer = async (
  sql: Sql,
  id: AccountId,
  event: AccessAccountDemoted,
  customerPolicy: AccessSessionPolicy,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`
      update public.accounts set kind = 'customer' where id = ${id}
    `;
    await tx`
      update public.memberships set role_ids = '{}'::uuid[]
      where account_id = ${id}
    `;
    await tx`
      update public.sessions s
      set expires_at = least(
        s.expires_at,
        coalesce(s.last_seen_at, s.created_at) +
          ${customerPolicy.idleTtlMs}::bigint * interval '1 millisecond',
        s.created_at +
          ${customerPolicy.maxLifetimeMs}::bigint * interval '1 millisecond'
      )
      from public.memberships m
      where m.id = s.membership_id
        and m.account_id = ${id}
        and s.status = 'active'
    `;
    await insertAuditEvent(tx, event);
  });
};

/** disable/enable share one audited UPDATE; only the patch differs. */
export const setAccountStatus = async (
  sql: Sql,
  id: AccountId,
  patch: {
    readonly status: 'active' | 'disabled';
    readonly disabledAt: string | null;
  },
  event: AccessAccountDisabled | AccessAccountEnabled,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`
      update public.accounts
      set status = ${patch.status}, disabled_at = ${patch.disabledAt}
      where id = ${id}
    `;
    await insertAuditEvent(tx, event);
  });
};
