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
  // Migration discipline (IndexedDB outlives deploys, so users carry old data):
  //  - This string declares only the PRIMARY KEY + INDEXES, never field shape.
  //  - To change a key/index, ADD `db.version(2).stores({…}).upgrade(tx => …)`;
  //    never mutate an existing version() in place, or clients on the old version
  //    corrupt. Dexie stores the version in the user's DB and runs each pending
  //    upgrade incrementally.
  //  - A non-indexed FIELD change (e.g. a new DTO field) needs NO version bump;
  //    it is handled on read by `parseItemDto` (migrate-on-read) instead.
  db.version(1).stores({
    items: 'id, status, updatedAt',
    outbox: 'id, status, entityId, createdAt',
  });
  return db;
};
