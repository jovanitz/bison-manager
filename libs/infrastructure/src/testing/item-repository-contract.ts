import { describe, expect, it } from 'vitest';
import type { Item, ItemId, ItemName } from '@acme/domain';
import type { ItemRepository } from '@acme/application';

/**
 * Contract test for the `ItemRepository` port.
 *
 * This is the "contract" tier of the testing strategy: a single behavioural
 * spec that EVERY adapter (in-memory, Dexie, REST) must satisfy. New adapters
 * call `itemRepositoryContract(() => createMyAdapter())` and inherit the whole
 * suite, guaranteeing they are genuinely interchangeable. `makeRepository` must
 * return a fresh, empty repository each call.
 */
const item = (over: Partial<Item> = {}): Item => ({
  id: 'item-1' as ItemId,
  name: 'Widget' as ItemName,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

export const itemRepositoryContract = (
  name: string,
  makeRepository: () => ItemRepository | Promise<ItemRepository>,
): void => {
  describe(`ItemRepository contract: ${name}`, () => {
    it('returns null for a missing item', async () => {
      const repo = await makeRepository();
      expect(await repo.findById('missing' as ItemId)).toBeNull();
    });

    it('saves and reads back an item', async () => {
      const repo = await makeRepository();
      await repo.save(item());
      const found = await repo.findById('item-1' as ItemId);
      expect(found?.name).toBe('Widget');
    });

    it('upserts on save with the same id', async () => {
      const repo = await makeRepository();
      await repo.save(item());
      await repo.save(item({ name: 'Renamed' as ItemName }));
      const found = await repo.findById('item-1' as ItemId);
      expect(found?.name).toBe('Renamed');
    });

    it('excludes archived items by default and includes them on request', async () => {
      const repo = await makeRepository();
      await repo.save(item({ id: 'a' as ItemId }));
      await repo.save(item({ id: 'b' as ItemId, status: 'archived' }));
      expect(await repo.list()).toHaveLength(1);
      expect(await repo.list({ includeArchived: true })).toHaveLength(2);
    });

    it('removes an item', async () => {
      const repo = await makeRepository();
      await repo.save(item());
      await repo.remove('item-1' as ItemId);
      expect(await repo.findById('item-1' as ItemId)).toBeNull();
    });
  });
};
