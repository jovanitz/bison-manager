import Dexie, { type Table } from 'dexie';
import type { ItemDto } from '@acme/application';
import type { Operation } from '@acme/application';

/**
 * The IndexedDB schema, expressed once via Dexie.
 *
 * We persist *DTOs*, not domain entities — the store should never know about
 * branded value objects. The `outbox` table backs the offline operation queue.
 * `AppDatabase` is a typed handle, created by a factory so tests can spin up an
 * isolated database (or a fake-indexeddb instance) per run.
 */
export type AppDatabase = Dexie & {
  items: Table<ItemDto, string>;
  outbox: Table<Operation, string>;
};

export const createDatabase = (name = 'acme-app'): AppDatabase => {
  const db = new Dexie(name) as AppDatabase;
  db.version(1).stores({
    items: 'id, status, updatedAt',
    outbox: 'id, status, entityId, createdAt',
  });
  return db;
};
