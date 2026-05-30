# ADR-0007: Offline-first with Dexie, an outbox queue, and last-write-wins

- Status: Accepted
- Date: 2026-06-05

## Context

Apps must keep working offline across all platforms (all of which run a WebView
or browser, so IndexedDB is available). We need optimistic updates and reliable
eventual synchronization.

## Decision

- **Local source of truth:** a Dexie (IndexedDB) repository. Reads and writes
  hit it immediately, so the UI never blocks on the network (optimistic).
- **Durable outbox:** every mutation is also appended to an `outbox` table as a
  serializable `Operation` (`OperationQueue` port). The
  `createOfflineItemRepository` decorator does this transparently, so use cases
  are unaware.
- **Sync engine:** `createSyncEngine` drains the outbox to the remote
  (`ApiClient`-backed) repository. The **platform `NetworkStatus`** port decides
  _when_ to run it (on reconnect / interval / resume) — scheduling stays out of
  business code.
- **Conflict resolution:** last-write-wins by a version derived from
  `updatedAt`. If the remote copy is newer, the local op is dropped and local is
  reconciled to remote; otherwise the remote is overwritten.

## Consequences

- Full offline operation with a recoverable, crash-safe queue.
- Conflict policy is simple and predictable; it can lose concurrent edits to the
  same field. Modules needing stronger guarantees can adopt CRDTs or
  per-field merges behind the same `OperationQueue`/`SyncEngine` seam.
- The whole loop is testable in Node with in-memory adapters
  (`sync-engine.spec.ts`).
