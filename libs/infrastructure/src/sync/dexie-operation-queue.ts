import type { Operation, OperationQueue } from '@acme/application';
import type { AppDatabase } from '../persistence/dexie-db';

/**
 * Durable, IndexedDB-backed implementation of the `OperationQueue` port.
 *
 * Every offline mutation is appended here as a serializable `Operation`. The
 * sync engine drains it when connectivity returns. Persisting to IndexedDB
 * means the queue survives reloads and crashes — true offline-first.
 */
export const createDexieOperationQueue = (
  db: AppDatabase,
): OperationQueue => ({
  enqueue: async (op) => {
    const full: Operation = { ...op, status: 'pending', attempts: 0 };
    await db.outbox.put(full);
  },
  pending: async () =>
    db.outbox
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('createdAt'),
  markSyncing: async (id) => {
    await db.outbox.update(id, { status: 'syncing' });
  },
  markSynced: async (id) => {
    await db.outbox.delete(id);
  },
  markFailed: async (id) => {
    const op = await db.outbox.get(id);
    await db.outbox.update(id, {
      status: 'failed',
      attempts: (op?.attempts ?? 0) + 1,
    });
  },
});
