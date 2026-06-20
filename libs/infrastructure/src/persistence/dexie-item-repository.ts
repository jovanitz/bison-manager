import { fromItemDto, parseItemDto, toItemDto } from '@acme/application';
import type { ItemRepository, ListOptions } from '@acme/application';
import type { Item } from '@acme/domain';
import type { AppDatabase } from './dexie-db';

/**
 * Dexie (IndexedDB) adapter for `ItemRepository` — the offline-first store.
 *
 * It maps domain entities to/from DTOs at the boundary and reads/writes the
 * `items` table. Because it satisfies the very same `ItemRepository` port as the
 * in-memory and REST adapters, the contract test suite runs against it
 * unchanged, and the use cases never know IndexedDB is involved.
 *
 * Reads go through `parseItemDto` (migrate-on-read): a record written by an
 * older app version is normalized to the current shape, and a corrupt one is
 * dropped rather than blindly cast — IndexedDB outlives deploys, so the data on
 * disk may not match today's model.
 */
export const createDexieItemRepository = (db: AppDatabase): ItemRepository => ({
  findById: async (id) => {
    const raw = await db.items.get(id);
    const dto = parseItemDto(raw);
    if (dto) return fromItemDto(dto);
    // Unrecoverable cache record → purge it. Items are reconstructible from the
    // server, so a corrupt local copy is pure junk; delete rather than linger.
    if (raw !== undefined) await db.items.delete(id);
    return null;
  },
  list: async (opts?: ListOptions) => {
    const rows = opts?.includeArchived
      ? await db.items.orderBy('updatedAt').toArray()
      : await db.items.where('status').equals('active').toArray();
    const out: Item[] = [];
    const corrupt: string[] = [];
    for (const row of rows) {
      const dto = parseItemDto(row);
      if (dto) out.push(fromItemDto(dto));
      else {
        const key = (row as { id?: unknown }).id;
        if (typeof key === 'string') corrupt.push(key);
      }
    }
    // Self-healing: purge the junk we found so it never lingers on disk.
    if (corrupt.length > 0) await db.items.bulkDelete(corrupt);
    return out;
  },
  save: async (item) => {
    await db.items.put(toItemDto(item));
  },
  remove: async (id) => {
    await db.items.delete(id);
  },
});
