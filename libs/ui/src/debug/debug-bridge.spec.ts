import { describe, expect, it } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { installDebugBridge, type DebugBridge } from './debug-bridge';
import type { AppUseCases } from '../di/use-cases-context';

const fakeQueryClient = (): QueryClient =>
  ({
    getQueryCache: () => ({
      getAll: () => [
        {
          queryKey: ['items'],
          state: {
            status: 'success',
            fetchStatus: 'idle',
            error: null,
            dataUpdatedAt: 123,
          },
        },
      ],
    }),
  }) as unknown as QueryClient;

const fakeUseCases = (): AppUseCases =>
  ({ items: {} }) as unknown as AppUseCases;

describe('installDebugBridge', () => {
  it('installs __app__ on the target and snapshots queries + use cases', () => {
    const target: Record<string, unknown> = {};
    installDebugBridge(
      { queryClient: fakeQueryClient(), useCases: fakeUseCases() },
      target,
    );

    const bridge = target['__app__'] as DebugBridge;
    const snap = bridge.snapshot();

    expect(snap.useCases).toEqual(['items']);
    expect(snap.queries).toHaveLength(1);
    expect(snap.queries[0]?.status).toBe('success');
    expect(snap.queries[0]?.key).toEqual(['items']);
  });

  it('records events and errors into capped ring buffers', () => {
    const target: Record<string, unknown> = {};
    const bridge = installDebugBridge(
      { queryClient: fakeQueryClient(), useCases: fakeUseCases() },
      target,
    );

    bridge.record('event', { type: 'ItemCreated' });
    bridge.record('error', 'boom');

    const snap = bridge.snapshot();
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.payload).toEqual({ type: 'ItemCreated' });
    expect(snap.errors[0]?.payload).toBe('boom');
  });

  it('does not throw when the query cache is unavailable', () => {
    const target: Record<string, unknown> = {};
    const broken = {} as unknown as QueryClient;
    const bridge = installDebugBridge(
      { queryClient: broken, useCases: fakeUseCases() },
      target,
    );
    expect(bridge.snapshot().queries).toEqual([]);
  });
});
