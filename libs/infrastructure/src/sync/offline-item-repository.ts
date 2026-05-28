import type { Clock, IdGenerator } from '@acme/shared';
import { toItemDto } from '@acme/application';
import type { ItemRepository, OperationQueue } from '@acme/application';

/**
 * Offline-first decorator around a local `ItemRepository`.
 *
 * Reads come straight from the fast local store. Writes are applied locally
 * *and* appended to the durable outbox as an `Operation`, so the change is never
 * lost and the UI updates optimistically. The sync engine later replays the
 * outbox to the server. Because this is itself an `ItemRepository`, the use
 * cases are completely unaware that syncing is happening underneath them.
 */
export type OfflineRepoDeps = {
  readonly local: ItemRepository;
  readonly queue: OperationQueue;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

export const createOfflineItemRepository = (
  deps: OfflineRepoDeps,
): ItemRepository => ({
  findById: deps.local.findById,
  list: deps.local.list,
  save: async (item) => {
    await deps.local.save(item);
    await deps.queue.enqueue({
      id: deps.ids.next(),
      kind: 'item.saved',
      entityId: item.id,
      payload: { item: toItemDto(item) },
      version: Date.parse(item.updatedAt),
      createdAt: deps.clock.now().toISOString(),
    });
  },
  remove: async (id) => {
    await deps.local.remove(id);
    await deps.queue.enqueue({
      id: deps.ids.next(),
      kind: 'item.deleted',
      entityId: id,
      payload: {},
      version: deps.clock.timestamp(),
      createdAt: deps.clock.now().toISOString(),
    });
  },
});
