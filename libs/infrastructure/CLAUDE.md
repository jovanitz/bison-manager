# libs/infrastructure — `layer:infrastructure`

Adapters that implement `application` ports for data & network.
**May import `application`, `domain`, `shared`.**

- **Holds:** Dexie persistence, REST/`ApiClient`, JWT auth, sync engine, testing
  fakes (`src/{persistence,api,sync,auth,testing}`).
- **Forbidden:** `platform`, `ui`. Don't leak adapters upward — only `apps/*`
  knows they exist.
- **Pattern:**
  - An adapter is a **factory function** `createXxx(deps) => Port` satisfying a
    port `type` from `application`. No classes.
  - Every adapter must pass the **same contract test** as the in-memory fake.
    Register it there and run `nx test infrastructure`.

- **Client storage migrations (IndexedDB outlives deploys).** A user keeps their
  local Dexie data across app versions, so persisted shapes drift from the code.
  Rules:
  - **Keys/indexes** (the `stores('id, status, …')` string): change them only by
    **adding** `db.version(n+1).stores({…}).upgrade(tx => …)` — never edit an
    existing `version()` in place (it corrupts clients on the old version). Dexie
    runs each pending upgrade incrementally from the version stored in the user's
    DB. See [src/persistence/dexie-db.ts](src/persistence/dexie-db.ts).
  - **Fields** (non-indexed DTO shape): no version bump needed — handle it
    **migrate-on-read**. Persist a `schemaVersion` on each record (`toItemDto`)
    and normalize/drop on read via a codec (`parseItemDto`); adapters read through
    it so an old or corrupt record is migrated or discarded, never blindly cast.
  - **Outbox**: validate every queued op through `parseOperation` before replay —
    a poison message written by an old version must not hit a newer server.
  - Pattern lives in [application/example/dto.ts](../application/src/example/dto.ts)
    - [application/ports/sync.ts](../application/src/ports/sync.ts); copy it for
      any new persisted DTO / queued op.

Examples: [src/persistence](src/persistence) · [src/api](src/api) ·
[src/sync](src/sync). Rationale: [ADR-0007](../../docs/adr/0007-offline-first-sync.md),
[ADR-0008](../../docs/adr/0008-provider-agnostic-auth-and-api.md).
