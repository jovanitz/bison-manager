import type {
  AccessAuditEvent,
  AccessGrant,
  AccessGrantId,
  AccountId,
  MembershipId,
} from '@acme/domain';
import type { Sql, TransactionSql } from 'postgres';

/** Accepts both the pool handle and a transaction handle. */
export type SqlLike = Sql | TransactionSql;

/**
 * Row ↔ domain mapping for the access tables, shared by every Postgres
 * adapter in this folder. Postgres returns timestamptz as Date and jsonb as
 * parsed values; domain speaks ISO strings and readonly arrays.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuid columns reject malformed ids with an error; a miss must be null. */
export const isUuid = (raw: string): boolean => UUID_RE.test(raw);

export const isoOf = (value: Date | string): string =>
  new Date(value).toISOString();

export const isoOrNull = (value: Date | string | null): string | null =>
  value === null ? null : isoOf(value);

type GrantRow = {
  readonly id: string;
  readonly kind: string;
  readonly membership_id: string;
  readonly target_account_id: string;
  readonly actions: ReadonlyArray<string>;
  readonly reason: string;
  readonly created_at: Date;
  readonly expires_at: Date;
  readonly revoked_at: Date | null;
  readonly expiry_recorded_at: Date | null;
};

export const grantFromRow = (row: GrantRow): AccessGrant => ({
  id: row.id as AccessGrantId,
  kind: row.kind as AccessGrant['kind'],
  membershipId: row.membership_id as MembershipId,
  targetAccountId: row.target_account_id as AccountId,
  actions: row.actions as AccessGrant['actions'],
  reason: row.reason,
  createdAt: isoOf(row.created_at),
  expiresAt: isoOf(row.expires_at),
  revokedAt: isoOrNull(row.revoked_at),
  expiryRecordedAt: isoOrNull(row.expiry_recorded_at),
});

const eventAccountId = (event: AccessAuditEvent): string | null => {
  if ('accountId' in event) return event.accountId;
  if ('targetAccountId' in event) return event.targetAccountId;
  // Org block/unblock: the subject IS an account. Identity blocks carry a user
  // id in `subjectId`, which must NOT land in the account_id FK column.
  if (
    (event.type === 'access.blocked' || event.type === 'access.unblocked') &&
    event.subjectKind === 'org'
  ) {
    return event.subjectId;
  }
  return null;
};

const eventMembershipId = (event: AccessAuditEvent): string | null => {
  if ('membershipId' in event) return event.membershipId;
  if ('actorMembershipId' in event) return event.actorMembershipId;
  return null;
};

/**
 * The one way an audit event reaches the table. Callers pass their
 * transaction handle so mutation + event commit or roll back together.
 */
export const insertAuditEvent = async (
  sql: SqlLike,
  event: AccessAuditEvent,
): Promise<void> => {
  await sql`
    insert into public.audit_events (type, occurred_at, account_id, membership_id, payload)
    values (
      ${event.type},
      ${event.occurredAt},
      ${eventAccountId(event)},
      ${eventMembershipId(event)},
      ${sql.json(event as never)}
    )
  `;
};
