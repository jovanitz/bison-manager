# libs/application — `layer:application`

Orchestration. **May import `domain` and `shared`.**

- **Holds:** use cases, **port TYPES** (`src/ports`), DTOs.
- **Forbidden:** `infrastructure`/`platform`/`ui`; React, browser, Dexie, HTTP,
  auth, native SDKs; classes; decorators; `throw` for expected failures.
- **Pattern:**
  - A new capability = **add/extend a port `type` here first**, before any adapter.
  - Use cases are factory functions that receive their ports/clock/ids as explicit
    parameters and return `Result`.
  - Test headlessly with in-memory adapters (`createInMemory*`) — no React, no
    backend. See [src/example/use-cases.spec.ts](src/example/use-cases.spec.ts).

Template: [src/example](src/example) · ports: [src/ports](src/ports).
Workflow: [workflow.md](../../docs/ai/workflow.md).
