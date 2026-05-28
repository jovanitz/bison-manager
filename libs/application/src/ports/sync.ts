/**
 * Offline operation-queue port.
 *
 * The offline-first strategy records every mutation as a serializable
 * `Operation` in a durable outbox while the device is offline, then replays it
 * when connectivity returns. The *queue* is a port (this file); the durable
 * Dexie-backed implementation and the replay engine live in infrastructure.
 */
export type Operation = {
  readonly id: string;
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly entityId: string;
  /** Lamport-style version for last-write-wins conflict resolution. */
  readonly version: number;
  readonly createdAt: string;
  readonly status: 'pending' | 'syncing' | 'failed';
  readonly attempts: number;
};

export type OperationQueue = {
  readonly enqueue: (
    op: Omit<Operation, 'status' | 'attempts'>,
  ) => Promise<void>;
  readonly pending: () => Promise<ReadonlyArray<Operation>>;
  readonly markSyncing: (id: string) => Promise<void>;
  readonly markSynced: (id: string) => Promise<void>;
  readonly markFailed: (id: string) => Promise<void>;
};
