import { z } from 'zod';

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
  /**
   * `dead-letter` is terminal: the op's envelope no longer parses (e.g. written
   * by an old app version), so it is quarantined — never replayed, never deleted
   * — and excluded from `pending`. Kept for inspection / a future migration,
   * because it represents a user write that never reached the server.
   */
  readonly status: 'pending' | 'syncing' | 'failed' | 'dead-letter';
  readonly attempts: number;
};

const operationSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  payload: z.record(z.unknown()),
  entityId: z.string().min(1),
  version: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  status: z.enum(['pending', 'syncing', 'failed', 'dead-letter']),
  attempts: z.number().int().nonnegative(),
});

/**
 * Validate an `Operation` read back from the durable outbox, or return `null` if
 * its envelope is malformed (the caller drops it instead of replaying it). The
 * outbox, like any client store, outlives deploys: a queued op written by an old
 * app version must never be replayed blindly against a newer server contract —
 * a poison message would corrupt server state. (The opaque `payload` is the sync
 * engine's concern per `kind`; this guards only the envelope.)
 */
export const parseOperation = (raw: unknown): Operation | null => {
  const parsed = operationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
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
