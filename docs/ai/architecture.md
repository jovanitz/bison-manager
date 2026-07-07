# AI context — Architecture & layer placement

Read this to decide **which layer a change belongs in** and **what it may
import**. The rules here are the same ones enforced by
`@nx/enforce-module-boundaries` in [eslint.config.mjs](../../eslint.config.mjs);
the machine-readable form is [capabilities.json](capabilities.json).

## Layers, in dependency order

| Layer            | Tag                    | Lives in                                                                                       | Responsibility                                                           | May import                        |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `shared`         | `layer:shared`         | `libs/shared`                                                                                  | `Result`/`Either`, branded types, clock & logger contracts               | _nothing_                         |
| `domain`         | `layer:domain`         | `libs/domain`                                                                                  | Entities, value objects, business rules, domain events — pure            | `shared`                          |
| `application`    | `layer:application`    | `libs/application`                                                                             | Use cases, **port types**, DTOs, **flows** (controllers) — orchestration | `domain`, `shared`                |
| `infrastructure` | `layer:infrastructure` | `libs/infrastructure`                                                                          | Adapters: Dexie, REST, JWT auth, sync engine                             | `application`, `domain`, `shared` |
| `platform`       | `layer:platform`       | `libs/platform`                                                                                | Device ports + browser/Capacitor/Tauri adapters                          | `application`, `domain`, `shared` |
| `ui`             | `layer:ui`             | `libs/ui`                                                                                      | Design system + feature screens + stores (read ViewModels, dispatch)     | `application`, `shared`           |
| `apps/*`         | `layer:app`            | `apps/*` (one folder per app; a giro ships several — api, dashboard, client + platform shells) | Composition roots — wire concrete adapters                               | everything                        |

## Where does my change go?

- **A business rule / invariant / calculation** → `domain`. No I/O, no async needed.
- **Orchestrating a workflow across repos/services** → `application` (a use case).
- **Orchestration that spans modules or feeds a screen** (compose use cases →
  ViewModel, derive `canX`) → a **flow/controller** in `application/src/flows`,
  never in a component. See [flows.md](flows.md).
- **A new capability the app needs from the outside world** → add a **port type**
  in `application` _first_, then an adapter in `infrastructure` (data/network) or
  `platform` (device).
- **Reading/writing a DB, calling an API, tokens** → `infrastructure`.
- **Camera, storage, notifications, native shell** → `platform`.
- **A screen, form, or visual component** → `ui`. It reads a **ViewModel** from a
  store and **dispatches** actions; it never orchestrates and never news up an
  adapter. The store delegates to a flow in `application` (see [flows.md](flows.md)).
- **Choosing which concrete adapter runs** → only `apps/*/composition-root.ts`.

## Key consequences

- `domain` + `application` are **portable**: identical behaviour in Node, browser,
  mobile and desktop because they take their clock, ids and collaborators as
  parameters.
- `ui` **cannot** import `infrastructure` or `platform`. If a screen "needs the
  database", it actually needs a use case; add/extend one in `application`.
- Adding a platform = one new `apps/*` + the native adapters; the inward layers do
  not change. See [new-platform.md](../guidelines/new-platform.md).
- Adding a **giro** (a new isolated product) = new thin API app + its own
  auth/DB project + its own `AccessConfig` vocabulary + its own migrations —
  never a schema/table shared with another giro. See
  [ADR-0017](../adr/0017-giro-isolation.md); `apps/app-b` is the seed shape.

## Folder layout per layer

```
libs/shared/src
libs/domain/src/example
libs/application/src/{example,ports,flows}
libs/infrastructure/src/{api,persistence,sync,auth,testing}
libs/platform/src/{browser,capacitor,tauri,fake}
libs/ui/src/{design-system,example,di,<app>/store}
```

Each `libs/<layer>/CLAUDE.md` holds that layer's local rules and patterns.
The "why" behind each rule is in the [ADRs](../adr/README.md).
