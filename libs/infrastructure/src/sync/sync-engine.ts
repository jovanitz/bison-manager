import type { Logger } from '@acme/shared';
import type {
  ItemRepository,
  Operation,
  OperationQueue,
} from '@acme/application';
import { fromItemDto } from '@acme/application';
import type { ItemDto } from '@acme/application';

/**
 * The background synchronization engine.
 *
 * Strategy (offline-first, optimistic):
 *   1. Use cases write to the *local* repository immediately and enqueue an
 *      `Operation` describing the change (optimistic update — the UI never
 *      waits for the network).
 *   2. When online, `runOnce` drains the outbox in order, applying each
 *      operation to the *remote* repository.
 *   3. Conflict resolution is last-write-wins by `version`: if the remote copy
 *      is newer than the operation, the operation is dropped and the local copy
 *      is reconciled to the remote. Otherwise the remote is overwritten.
 *
 * The engine is a plain factory of pure-ish functions; it owns no timers. The
 * platform layer decides *when* to call `runOnce` (network-status change,
 * interval, app resume), keeping scheduling out of the business code.
 */
export type SyncEngineDeps = {
  readonly queue: OperationQueue;
  readonly local: ItemRepository;
  readonly remote: ItemRepository;
  readonly logger: Logger;
};

export type SyncReport = {
  readonly synced: number;
  readonly conflicts: number;
  readonly failed: number;
};

export const createSyncEngine = (deps: SyncEngineDeps) => {
  const applyOperation = async (
    op: Operation,
  ): Promise<'synced' | 'conflict'> => {
    if (op.kind === 'item.deleted') {
      await deps.remote.remove(op.entityId as never);
      return 'synced';
    }

    const dto = op.payload['item'] as ItemDto;
    const incoming = fromItemDto(dto);
    const remoteCopy = await deps.remote.findById(incoming.id);

    // Last-write-wins conflict resolution.
    if (remoteCopy && remoteCopy.updatedAt > incoming.updatedAt) {
      // Remote is newer: reconcile local to remote, drop our change.
      await deps.local.save(remoteCopy);
      return 'conflict';
    }

    await deps.remote.save(incoming);
    return 'synced';
  };

  const runOnce = async (): Promise<SyncReport> => {
    const pending = await deps.queue.pending();
    let synced = 0;
    let conflicts = 0;
    let failed = 0;

    for (const op of pending) {
      await deps.queue.markSyncing(op.id);
      try {
        const outcome = await applyOperation(op);
        await deps.queue.markSynced(op.id);
        if (outcome === 'conflict') conflicts += 1;
        else synced += 1;
      } catch (cause) {
        await deps.queue.markFailed(op.id);
        failed += 1;
        deps.logger.warn('sync.operation_failed', { id: op.id, cause });
      }
    }

    deps.logger.info('sync.completed', { synced, conflicts, failed });
    return { synced, conflicts, failed };
  };

  return { runOnce };
};
