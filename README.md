# Acme — Cross-Platform Application Architecture

A reusable, production-ready foundation for building multiple products across
**Web, PWA, iOS, Android, Windows and macOS** from one codebase.

Built on Clean + Hexagonal architecture, functional TypeScript, and an Nx
monorepo with mechanically-enforced boundaries. Business logic is portable and
runs in any environment — it depends on **no** framework, browser API, database,
or platform SDK.

## Tech stack

TypeScript · React · Vite · Nx · React Router · React Hook Form · Zod · Zustand ·
TanStack Query · TailwindCSS · Shadcn-style UI · Vitest · Testing Library ·
Capacitor (mobile) · Tauri (desktop) · Dexie (offline).

## Monorepo layout

```
apps/
  web/        Web + PWA (Vite, vite-plugin-pwa)
  mobile/     iOS + Android (Capacitor wraps the web build)
  desktop/    Windows + macOS (Tauri wraps the web build)
libs/
  domain/         Entities, value objects, rules, events — pure, no deps
  application/    Use cases, ports, DTOs — depends only on domain
  infrastructure/ Adapters: Dexie, REST, JWT auth, sync engine
  platform/       Device ports + browser/Capacitor/Tauri adapters
  ui/             Design system + feature screens (consume use cases)
  shared/         Result/Either, branded types, logger & clock contracts
```

Dependencies point inward and are enforced by Nx tags — see
[docs/dependency-graph.md](docs/dependency-graph.md).

## Quick start

Prerequisites (one-time, machine-level): **Node ≥22**, **pnpm**
(`corepack enable`), **Docker Desktop** (running) and the
**Supabase CLI** (`brew install supabase/tap/supabase`).

```bash
pnpm install

pnpm stack              # local Supabase in Docker (Postgres/Auth/Studio;
                        #   applies migrations + seed — first run pulls images)
pnpm api                # backend http://localhost:3333 (+ /dev test console)
pnpm web                # web app http://localhost:4200 (login at /login)

# Quality gates
pnpm exec nx affected -t lint typecheck test build
pnpm graph              # interactive dependency graph
```

No credentials needed: everything runs against the local stack with public dev
defaults ([apps/api/.env.development](apps/api/.env.development)); personal
overrides go in a gitignored `apps/api/.env`. Without Docker, the api falls
back to an in-memory stub (comment out the `SUPABASE_*` vars) and the
Postgres-bound specs skip themselves. Auth/authorization design:
[ADR-0010](docs/adr/0010-authorization-permissions-and-grants.md) ·
[supabase/README.md](supabase/README.md).

Mobile/desktop need their native toolchains and SDKs installed; the native
imports are isolated to a single `native-*.ts` file in each app (stubbed for CI).

## The Example Module

A generic `Item` feature demonstrates every layer end-to-end. Trace it to learn
the architecture:

| Deliverable                       | File                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Domain entity + rules             | [libs/domain/src/example/item.ts](libs/domain/src/example/item.ts)                                               |
| Value objects                     | [libs/domain/src/example/value-objects.ts](libs/domain/src/example/value-objects.ts)                             |
| Use cases                         | [libs/application/src/example/use-cases.ts](libs/application/src/example/use-cases.ts)                           |
| Repository port                   | [libs/application/src/example/ports.ts](libs/application/src/example/ports.ts)                                   |
| In-memory / Dexie / REST adapters | [libs/infrastructure/src/persistence](libs/infrastructure/src/persistence) · [/api](libs/infrastructure/src/api) |
| Offline sync                      | [libs/infrastructure/src/sync](libs/infrastructure/src/sync)                                                     |
| Capacitor adapter                 | [libs/platform/src/capacitor/capacitor-platform.ts](libs/platform/src/capacitor/capacitor-platform.ts)           |
| Tauri adapter                     | [libs/platform/src/tauri/tauri-platform.ts](libs/platform/src/tauri/tauri-platform.ts)                           |
| React feature screen              | [libs/ui/src/example/item-screen.tsx](libs/ui/src/example/item-screen.tsx)                                       |
| Composition root                  | [apps/web/src/composition-root.ts](apps/web/src/composition-root.ts)                                             |

## Documentation

- [Architecture Decision Records](docs/adr/README.md)
- [Dependency graph & boundary rules](docs/dependency-graph.md)
- [Creating a new feature](docs/guidelines/new-feature.md)
- [Adding a new platform](docs/guidelines/new-platform.md)
- [Maintaining boundaries](docs/guidelines/maintaining-boundaries.md)
- [AI-assisted development](docs/guidelines/ai-assisted-development.md)

## Principles (enforced, not aspirational)

- Pure functions, immutable data, **no classes/decorators** (lint-enforced).
- `Result`/`Either` for expected failures — exceptions only for bugs.
- Ports are **types**; adapters are **factory functions**; DI is **explicit
  parameters**, wired in per-app **composition roots** (no container).
- Business logic never imports React, the browser, Dexie, Capacitor, Tauri, an
  HTTP client, or an auth provider.
