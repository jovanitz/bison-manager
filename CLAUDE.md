# CLAUDE.md — AI development harness (index)

This file is the **router**. It is auto-loaded as context. It is intentionally
short: it tells you *where to look*, not everything at once. Read the linked doc
only when the task needs it (progressive disclosure).

> **Acme** is a Clean + Hexagonal, fully-functional TypeScript app built as an Nx
> monorepo that ships to Web, PWA, iOS, Android, Windows and macOS from one
> codebase. Business logic is portable: it imports no framework, browser, DB or
> SDK.

## Read this when…

| You are about to…                              | Read |
| ---------------------------------------------- | ---- |
| Understand the harness terms (Guides/Sensors/Guardrails) | [docs/ai/harness.md](docs/ai/harness.md) |
| Place a change in the right layer / import     | [docs/ai/architecture.md](docs/ai/architecture.md) |
| Check what is **forbidden** (hard rules)       | [docs/ai/constraints.md](docs/ai/constraints.md) |
| Build a feature end-to-end (the agent loop)    | [docs/ai/workflow.md](docs/ai/workflow.md) |
| Measure quality / impact / perf / gaps (sensors) | [docs/ai/sensors.md](docs/ai/sensors.md) |
| Know a layer's local rules                     | the `CLAUDE.md` inside that `libs/<layer>/` |
| Understand *why* a rule exists                 | [docs/adr/README.md](docs/adr/README.md) |

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

## Non-negotiables (full list in constraints.md)

- **No classes, no decorators.** Pure functions + factory functions only.
- **Return `Result`/`Either`, never `throw`** for expected failures.
- **`domain` and `application` import no React, browser, DB, HTTP, auth or
  native SDK.** They run in plain Node.
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
