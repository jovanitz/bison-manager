import { fromItemDto, toItemDto } from '@acme/application';
import type { ItemRepository, ListOptions } from '@acme/application';
import type { AppDatabase } from './dexie-db';

/**
 * Dexie (IndexedDB) adapter for `ItemRepository` — the offline-first store.
 *
 * It maps domain entities to/from DTOs at the boundary and reads/writes the
 * `items` table. Because it satisfies the very same `ItemRepository` port as the
 * in-memory and REST adapters, the contract test suite runs against it
 * unchanged, and the use cases never know IndexedDB is involved.
 */
export const createDexieItemRepository = (
  db: AppDatabase,
): ItemRepository => ({
  findById: async (id) => {
    const dto = await db.items.get(id);
    return dto ? fromItemDto(dto) : null;
  },
  list: async (opts?: ListOptions) => {
    const dtos = opts?.includeArchived
      ? await db.items.orderBy('updatedAt').toArray()
      : await db.items.where('status').equals('active').toArray();
    return dtos.map(fromItemDto);
  },
  save: async (item) => {
    await db.items.put(toItemDto(item));
  },
  remove: async (id) => {
    await db.items.delete(id);
  },
});
