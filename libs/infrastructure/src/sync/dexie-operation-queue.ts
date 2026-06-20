import { parseOperation } from '@acme/application';
import type { Operation, OperationQueue } from '@acme/application';
import type { AppDatabase } from '../persistence/dexie-db';

/**
 * Durable, IndexedDB-backed implementation of the `OperationQueue` port.
 *
 * Every offline mutation is appended here as a serializable `Operation`. The
 * sync engine drains it when connectivity returns. Persisting to IndexedDB
 * means the queue survives reloads and crashes — true offline-first.
 *
 * `pending` validates each row through `parseOperation` and drops any whose
 * envelope is malformed: the outbox outlives deploys, so a record written by an
 * old app version must never be replayed blindly against a newer server.
 */
export const createDexieOperationQueue = (db: AppDatabase): OperationQueue => ({
  enqueue: async (op) => {
    const full: Operation = { ...op, status: 'pending', attempts: 0 };
    await db.outbox.put(full);
  },
  pending: async () => {
    const rows = await db.outbox
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('createdAt');
    const ok: Operation[] = [];
    const poison: string[] = [];
    for (const row of rows) {
      const op = parseOperation(row);
      if (op) ok.push(op);
      else {
        const key = (row as { id?: unknown }).id;
        if (typeof key === 'string') poison.push(key);
      }
    }
    // Quarantine, don't delete: a poison op is a user write that never synced.
    // `dead-letter` is terminal, so it drops out of this query forever (never
    // replayed) yet stays on disk for inspection / a future migration.
    await Promise.all(
      poison.map((id) => db.outbox.update(id, { status: 'dead-letter' })),
    );
    return ok;
  },
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
