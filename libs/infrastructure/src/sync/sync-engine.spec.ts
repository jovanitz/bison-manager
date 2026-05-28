import { describe, expect, it } from 'vitest';
import {
  fixedClock,
  noopLogger,
  sequentialIdGenerator,
} from '@acme/shared';
import { makeItemUseCases, nullEventPublisher } from '@acme/application';
import { createInMemoryItemRepository } from '../persistence/in-memory-item-repository';
import { createInMemoryOperationQueue } from './in-memory-operation-queue';
import { createOfflineItemRepository } from './offline-item-repository';
import { createSyncEngine } from './sync-engine';

/**
 * Integration test of the whole offline-first loop:
 * create an item while "offline" -> it lands locally and in the outbox ->
 * run the sync engine -> it appears on the "remote" and the outbox drains.
 */
describe('offline sync loop', () => {
  const setup = () => {
    const clock = fixedClock(new Date('2026-01-01T00:00:00.000Z'));
    const ids = sequentialIdGenerator('op');
    const local = createInMemoryItemRepository();
    const remote = createInMemoryItemRepository();
    const queue = createInMemoryOperationQueue();

    const offlineRepo = createOfflineItemRepository({
      local,
      queue,
      clock,
      ids,
    });

    const useCases = makeItemUseCases({
      repository: offlineRepo,
      clock,
      ids: sequentialIdGenerator('item'),
      events: nullEventPublisher,
      logger: noopLogger,
    });

    const engine = createSyncEngine({ queue, local, remote, logger: noopLogger });
    return { useCases, engine, local, remote, queue };
  };

  it('persists locally and queues an operation while offline', async () => {
    const { useCases, remote, queue } = setup();
    const created = await useCases.create({ name: 'Offline Item' });
    expect(created.ok).toBe(true);

    // Remote has not been touched yet; outbox holds the pending op.
    expect(await remote.list()).toHaveLength(0);
    expect(await queue.pending()).toHaveLength(1);
  });

  it('replays the outbox to the remote when sync runs', async () => {
    const { useCases, engine, remote, queue } = setup();
    await useCases.create({ name: 'Offline Item' });

    const report = await engine.runOnce();

    expect(report.synced).toBe(1);
    expect(await remote.list()).toHaveLength(1);
    expect(await queue.pending()).toHaveLength(0);
  });
});
