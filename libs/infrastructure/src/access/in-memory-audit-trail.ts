import type {
  AccessAuditFilter,
  AccessAuditRecord,
  AccessAuditTrail,
} from '@acme/application';
import type { AccessAuditEvent } from '@acme/domain';
import type { AccessStoreState } from './in-memory-access-seed';

export const appendInMemoryAuditRecord = (
  state: AccessStoreState,
  event: AccessAuditEvent,
): void => {
  state.auditRecords.push({
    id: `audit-${state.auditRecords.length + 1}`,
    event,
  });
};

const eventAccountId = (event: AccessAuditEvent): string | null => {
  if ('accountId' in event) return event.accountId;
  if ('targetAccountId' in event) return event.targetAccountId;
  return null;
};

const matchesFilter = (
  record: AccessAuditRecord,
  filter?: AccessAuditFilter,
): boolean => {
  if (!filter) return true;
  if (filter.types && !filter.types.includes(record.event.type)) return false;
  if (filter.accountId && eventAccountId(record.event) !== filter.accountId) {
    return false;
  }
  return true;
};

export const makeInMemoryAuditTrail = (
  state: AccessStoreState,
): AccessAuditTrail => ({
  append: async (event) => {
    appendInMemoryAuditRecord(state, event);
  },
  list: async (filter) => {
    const matching = state.auditRecords.filter((r) => matchesFilter(r, filter));
    return filter?.limit === undefined
      ? matching
      : matching.slice(0, filter.limit);
  },
});
