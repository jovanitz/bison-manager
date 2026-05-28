import { describe, expect, it } from 'vitest';
import {
  fixedClock,
  noopLogger,
  sequentialIdGenerator,
} from '@acme/shared';
import type { Item, ItemId } from '@acme/domain';
import { nullEventPublisher } from '../ports/event-publisher';
import type { ItemRepository, ListOptions } from './ports';
import { makeItemUseCases } from './use-cases';

/**
 * A hand-rolled in-memory repository for use-case tests. It implements the same
 * port the real Dexie/REST adapters implement, which is exactly why the use
 * cases need no real database to be tested.
 */
const inMemoryRepo = (seed: Item[] = []): ItemRepository => {
  const store = new Map<string, Item>(seed.map((i) => [i.id, i]));
  return {
    findById: async (id) => store.get(id) ?? null,
    list: async (opts?: ListOptions) =>
      [...store.values()].filter(
        (i) => opts?.includeArchived || i.status === 'active',
      ),
    save: async (item) => {
      store.set(item.id, item);
    },
    remove: async (id) => {
      store.delete(id);
    },
  };
};

const deps = (repo: ItemRepository) => ({
  repository: repo,
  clock: fixedClock(new Date('2026-01-01T00:00:00.000Z')),
  ids: sequentialIdGenerator('item'),
  events: nullEventPublisher,
  logger: noopLogger,
});

describe('Item use cases', () => {
  it('creates an item end to end', async () => {
    const repo = inMemoryRepo();
    const uc = makeItemUseCases(deps(repo));
    const r = await uc.create({ name: 'Widget' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Widget');
      expect(r.value.status).toBe('active');
      expect(await repo.findById(r.value.id as ItemId)).not.toBeNull();
    }
  });

  it('surfaces validation errors from the domain', async () => {
    const uc = makeItemUseCases(deps(inMemoryRepo()));
    const r = await uc.create({ name: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-item-name');
  });

  it('returns item-not-found when renaming a missing item', async () => {
    const uc = makeItemUseCases(deps(inMemoryRepo()));
    const r = await uc.rename({ id: 'nope', name: 'X' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/item-not-found');
  });

  it('archives and hides items from the default list', async () => {
    const repo = inMemoryRepo();
    const uc = makeItemUseCases(deps(repo));
    const created = await uc.create({ name: 'Widget' });
    if (!created.ok) throw new Error('setup');
    await uc.archive({ id: created.value.id });
    expect(await uc.list()).toHaveLength(0);
    expect(await uc.list({ includeArchived: true })).toHaveLength(1);
  });
});
