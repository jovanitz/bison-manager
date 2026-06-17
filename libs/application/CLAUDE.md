# libs/application — `layer:application`

Orchestration. **May import `domain` and `shared`.**

- **Holds:** use cases (atomic), **port TYPES** (`src/ports`), DTOs, and
  **flows** (`src/flows`) — headless controllers that compose use cases into
  ViewModels + enumerable command registries (see below).
- **Forbidden:** `infrastructure`/`platform`/`ui`; React, browser, Dexie, HTTP,
  auth, native SDKs, **state libs (Zustand)**; classes; decorators; `throw` for
  expected failures. Stays framework-free so the UI store AND a future MCP server
  reuse it identically.
- **Pattern:**
  - A new capability = **add/extend a port `type` here first**, before any adapter.
  - Use cases are factory functions that receive their ports/clock/ids as explicit
    parameters and return `Result`.
  - **Flows** (orchestration that spans modules / feeds a screen) are functions
    `(deps, input) => Result<ViewModel | void>` with deps passed explicitly; each
    is registered in a catalog (`CLIENT_FLOWS`/`DASHBOARD_FLOWS`) so it is
    MCP-enumerable. This — not the component — owns all flow logic.
  - Test headlessly with in-memory adapters (`createInMemory*`) / fake deps — no
    React, no backend. See [src/example/use-cases.spec.ts](src/example/use-cases.spec.ts)
    and the flows' mock-MCP specs ([src/flows/client/registry.spec.ts](src/flows/client/registry.spec.ts)).

Template: [src/example](src/example) · ports: [src/ports](src/ports) ·
flows: [src/flows](src/flows). Architecture: [flows.md](../../docs/ai/flows.md).
