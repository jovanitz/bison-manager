import type { Operation, OperationQueue } from '@acme/application';

/**
 * In-memory `OperationQueue` for tests and "simulate offline" scenarios.
 * Mirrors the semantics of the Dexie-backed queue without IndexedDB.
 */
export const createInMemoryOperationQueue = (): OperationQueue => {
  const ops = new Map<string, Operation>();
  return {
    enqueue: async (op) => {
      ops.set(op.id, { ...op, status: 'pending', attempts: 0 });
    },
    pending: async () =>
      [...ops.values()]
        .filter((o) => o.status === 'pending' || o.status === 'failed')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    markSyncing: async (id) => {
      const op = ops.get(id);
      if (op) ops.set(id, { ...op, status: 'syncing' });
    },
    markSynced: async (id) => {
      ops.delete(id);
    },
    markFailed: async (id) => {
      const op = ops.get(id);
      if (op)
        ops.set(id, { ...op, status: 'failed', attempts: op.attempts + 1 });
    },
  };
};
