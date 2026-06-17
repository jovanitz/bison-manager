# CLAUDE.md — AI development harness (index)

This file is the **router**. It is auto-loaded as context. It is intentionally
short: it tells you _where to look_, not everything at once. Read the linked doc
only when the task needs it (progressive disclosure).

> **Acme** is a Clean + Hexagonal, fully-functional TypeScript app built as an Nx
> monorepo that ships to Web, PWA, iOS, Android, Windows and macOS from one
> codebase. Business logic is portable: it imports no framework, browser, DB or
> SDK.

## Read this when…

| You are about to…                                           | Read                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| See the whole harness at a glance (what fires when)         | [docs/ai/harness-overview.md](docs/ai/harness-overview.md) |
| Understand the harness terms (Guides/Sensors/Guardrails)    | [docs/ai/harness.md](docs/ai/harness.md)                   |
| Place a change in the right layer / import                  | [docs/ai/architecture.md](docs/ai/architecture.md)         |
| Check what is **forbidden** (hard rules)                    | [docs/ai/constraints.md](docs/ai/constraints.md)           |
| Build something sensitive (auth, tokens, perms)             | [docs/ai/security.md](docs/ai/security.md)                 |
| Understand how **auth/access actually works** (the model)   | [docs/ai/auth.md](docs/ai/auth.md)                         |
| Build a feature end-to-end (the agent loop)                 | [docs/ai/workflow.md](docs/ai/workflow.md)                 |
| Touch a screen / cross-module orchestration (flows, stores) | [docs/ai/flows.md](docs/ai/flows.md)                       |
| Model the domain & work test-first (DDD/TDD)                | [docs/ai/methodology.md](docs/ai/methodology.md)           |
| Organize files/folders (small, screaming arch)              | [docs/ai/structure.md](docs/ai/structure.md)               |
| Measure quality / impact / perf / gaps (sensors)            | [docs/ai/sensors.md](docs/ai/sensors.md)                   |
| Know a layer's local rules                                  | the `CLAUDE.md` inside that `libs/<layer>/`                |
| Understand _why_ a rule exists                              | [docs/adr/README.md](docs/adr/README.md)                   |

Machine-readable layer rules (use cases, not prose): [docs/ai/capabilities.json](docs/ai/capabilities.json).

## The 30-second model

```
apps/*  → may use everything (composition roots; the only place adapters are wired)
ui      → application, shared            (never infrastructure / platform)
infra   → application, domain, shared
platform→ application, domain, shared
application → domain, shared
domain  → shared
shared  → nothing
```

Dependencies point **inward**. Violations fail `nx lint` — the architecture
cannot silently rot.

**Inside a screen** the flow is one-way: `UI → Store → Controller → Use case →
Domain`. Components read ViewModels and dispatch; cross-module orchestration
lives in headless **flows** (`libs/application/src/flows`), never in a component
or a store. See [docs/ai/flows.md](docs/ai/flows.md).

## Non-negotiables (full list in constraints.md)

- **No classes, no decorators.** Pure functions + factory functions only.
- **Return `Result`/`Either`, never `throw`** for expected failures.
- **`domain` and `application` import no React, browser, DB, HTTP, auth, native
  SDK or state libs (Zustand).** They run in plain Node; stores live in `ui`.
- **Ports are `type`s; adapters are factory functions.** DI is explicit
  parameters, wired only in `apps/*/composition-root.ts`.

## Canonical template

The `Item` example threads every layer. Copy its shape for new features:
domain → [libs/domain/src/example](libs/domain/src/example) ·
use cases/ports → [libs/application/src/example](libs/application/src/example) ·
adapters → [libs/infrastructure/src/persistence](libs/infrastructure/src/persistence) ·
screen → [libs/ui/src/example](libs/ui/src/example) ·
wiring → [apps/web/src/composition-root.ts](apps/web/src/composition-root.ts).

## Quality gate (run before declaring work done)

```bash
pnpm harness quality        # lint + typecheck + test on affected projects (a sensor)
```

The same gate is enforced automatically as a **guardrail** (the Stop hook) — see
[docs/ai/harness.md](docs/ai/harness.md). Other sensors: `pnpm harness gaps|impact|perf`.
