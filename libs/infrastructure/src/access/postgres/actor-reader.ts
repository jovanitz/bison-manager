import type { AccessActorReader } from '@acme/application';
import type {
  AccessActor,
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
  SessionStatus,
  UserId,
} from '@acme/domain';
import type { Sql } from 'postgres';
import { grantFromRow, isUuid, isoOf } from './rows';

type ActorRow = {
  readonly session_status: string;
  readonly session_expires_at: Date;
  readonly session_created_at: Date;
  readonly membership_id: string;
  readonly user_id: string;
  readonly account_id: string;
  readonly permissions: AccessActor['permissions'];
  readonly account_status: string;
  readonly account_kind: string;
  readonly is_root: boolean;
  readonly blocked: boolean;
};

/**
 * Resolves the actor with one join over current rows — never from claims —
 * so a disable/revoke/permission change is visible on the very next request.
 * All grants of the membership are loaded (expired ones included): the use
 * cases need them for lazy `grant.expired` recording.
 */
export const createPostgresActorReader = (sql: Sql): AccessActorReader => ({
  findActorBySession: async (sessionId) => {
    if (!isUuid(sessionId)) return null;
    const rows = await sql<ActorRow[]>`
      select
        s.status as session_status,
        s.expires_at as session_expires_at,
        s.created_at as session_created_at,
        m.id as membership_id,
        m.user_id,
        m.account_id,
        m.permissions,
        m.is_root,
        a.status as account_status,
        a.kind as account_kind,
        (a.blocked or m.blocked or exists (
          select 1 from public.blocked_identities bi where bi.user_id = m.user_id
        )) as blocked
      from public.sessions s
      join public.memberships m on m.id = s.membership_id
      join public.accounts a on a.id = m.account_id
      where s.id = ${sessionId}
    `;
    const row = rows[0];
    if (!row) return null;

    const grantRows = await sql`
      select * from public.access_grants
      where membership_id = ${row.membership_id}
      order by created_at asc
    `;

    return {
      membership: {
        id: row.membership_id as MembershipId,
        userId: row.user_id as UserId,
        accountId: row.account_id as AccountId,
      },
      accountStatus: row.account_status as AccountStatus,
      accountKind: row.account_kind as AccountKind,
      isRoot: row.is_root,
      blocked: row.blocked,
      session: {
        id: sessionId,
        status: row.session_status as SessionStatus,
        expiresAt: isoOf(row.session_expires_at),
        createdAt: isoOf(row.session_created_at),
      },
      permissions: row.permissions,
      grants: grantRows.map((grant) => grantFromRow(grant as never)),
    };
  },
});
