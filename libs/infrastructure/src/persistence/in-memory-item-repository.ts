import type { Item } from '@acme/domain';
import type { ItemRepository, ListOptions } from '@acme/application';

/**
 * In-memory adapter for `ItemRepository`.
 *
 * A plain factory function returning a plain object — no class, no inheritance.
 * It is production-grade for tests, and doubles as the canonical
 * reference implementation that the contract tests pin every other adapter to.
 */
export const createInMemoryItemRepository = (
  seed: ReadonlyArray<Item> = [],
): ItemRepository => {
  const store = new Map<string, Item>(seed.map((i) => [i.id, i]));

  return {
    findById: async (id) => store.get(id) ?? null,
    list: async (opts?: ListOptions) =>
      [...store.values()]
        .filter((i) => opts?.includeArchived || i.status === 'active')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    save: async (item) => {
      store.set(item.id, item);
    },
    remove: async (id) => {
      store.delete(id);
    },
  };
};
