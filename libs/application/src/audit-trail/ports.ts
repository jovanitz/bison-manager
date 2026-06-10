import type { AccessAuditEvent, AccessAuditEventType } from '@acme/domain';

/**
 * The append-only audit trail.
 *
 * `append` exists for events that are not the by-product of a sensitive write
 * (e.g. `login.succeeded` / `login.failed`, recorded by the API layer).
 * Events that DO accompany a mutation are persisted transactionally by the
 * write ports themselves — they all land in the same trail this port reads.
 */
export type AccessAuditRecord = {
  readonly id: string;
  readonly event: AccessAuditEvent;
};

export type AccessAuditFilter = {
  readonly types?: ReadonlyArray<AccessAuditEventType>;
  readonly accountId?: string;
  readonly limit?: number;
};

export type AccessAuditTrail = {
  readonly append: (event: AccessAuditEvent) => Promise<void>;
  readonly list: (
    filter?: AccessAuditFilter,
  ) => Promise<ReadonlyArray<AccessAuditRecord>>;
};
