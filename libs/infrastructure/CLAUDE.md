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

Examples: [src/persistence](src/persistence) · [src/api](src/api) ·
[src/sync](src/sync). Rationale: [ADR-0007](../../docs/adr/0007-offline-first-sync.md),
[ADR-0008](../../docs/adr/0008-provider-agnostic-auth-and-api.md).
