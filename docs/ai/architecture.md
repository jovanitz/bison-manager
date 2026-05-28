# AI context — Architecture & layer placement

Read this to decide **which layer a change belongs in** and **what it may
import**. The rules here are the same ones enforced by
`@nx/enforce-module-boundaries` in [eslint.config.mjs](../../eslint.config.mjs);
the machine-readable form is [capabilities.json](capabilities.json).

## Layers, in dependency order

| Layer            | Tag                    | Lives in                 | Responsibility | May import |
| ---------------- | ---------------------- | ------------------------ | -------------- | ---------- |
| `shared`         | `layer:shared`         | `libs/shared`            | `Result`/`Either`, branded types, clock & logger contracts | _nothing_ |
| `domain`         | `layer:domain`         | `libs/domain`            | Entities, value objects, business rules, domain events — pure | `shared` |
| `application`    | `layer:application`    | `libs/application`       | Use cases, **port types**, DTOs — orchestration | `domain`, `shared` |
| `infrastructure` | `layer:infrastructure` | `libs/infrastructure`    | Adapters: Dexie, REST, JWT auth, sync engine | `application`, `domain`, `shared` |
| `platform`       | `layer:platform`       | `libs/platform`          | Device ports + browser/Capacitor/Tauri adapters | `application`, `domain`, `shared` |
| `ui`             | `layer:ui`             | `libs/ui`                | Design system + feature screens (consume use cases) | `application`, `shared` |
| `apps/*`         | `layer:app`            | `apps/{web,mobile,desktop}` | Composition roots — wire concrete adapters | everything |

## Where does my change go?

- **A business rule / invariant / calculation** → `domain`. No I/O, no async needed.
- **Orchestrating a workflow across repos/services** → `application` (a use case).
- **A new capability the app needs from the outside world** → add a **port type**
  in `application` *first*, then an adapter in `infrastructure` (data/network) or
  `platform` (device).
- **Reading/writing a DB, calling an API, tokens** → `infrastructure`.
- **Camera, storage, notifications, native shell** → `platform`.
- **A screen, form, or visual component** → `ui`. It receives use cases via the
  `UseCasesProvider` context — it never news up an adapter.
- **Choosing which concrete adapter runs** → only `apps/*/composition-root.ts`.

## Key consequences

- `domain` + `application` are **portable**: identical behaviour in Node, browser,
  mobile and desktop because they take their clock, ids and collaborators as
  parameters.
- `ui` **cannot** import `infrastructure` or `platform`. If a screen "needs the
  database", it actually needs a use case; add/extend one in `application`.
- Adding a platform = one new `apps/*` + the native adapters; the inward layers do
  not change. See [new-platform.md](../guidelines/new-platform.md).

## Folder layout per layer

```
libs/shared/src
libs/domain/src/example
libs/application/src/{example,ports}
libs/infrastructure/src/{api,persistence,sync,auth,testing}
libs/platform/src/{browser,capacitor,tauri,fake}
libs/ui/src/{design-system,example,di}
```

Each `libs/<layer>/CLAUDE.md` holds that layer's local rules and patterns.
The "why" behind each rule is in the [ADRs](../adr/README.md).
