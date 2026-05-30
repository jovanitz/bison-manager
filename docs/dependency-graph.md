# Dependency Graph

## Layer dependency rules (enforced)

These rules are enforced at lint time by `@nx/enforce-module-boundaries` in
[`eslint.config.mjs`](../eslint.config.mjs). An arrow `A → B` means "A may import B".

```
                       ┌─────────────────────────────┐
                       │            apps/*            │  layer:app
                       │    web · mobile · desktop    │  (composition roots)
                       │                              │  → may depend on ALL
                       └───────────────┬─────────────┘
            ┌──────────────┬───────────┼────────────┬──────────────┐
            ▼              ▼            ▼            ▼              ▼
      ┌──────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
      │    ui    │  │infrastructure│ │ platform │ │application│  │  domain  │
      │layer:ui  │  │layer:infra   │ │layer:plat│ │layer:app… │  │layer:dom…│
      └────┬─────┘  └──────┬───────┘ └────┬─────┘ └────┬─────┘  └────┬─────┘
           │               │              │            │             │
           │ application,  │ application, │ application,│ domain      │ (nothing
           │ shared        │ domain       │ domain      │             │  but shared)
           ▼               ▼              ▼            ▼             ▼
        application    application    application   domain        shared
                            +              +
                          domain         domain
                            │              │
                            └──────┬───────┘
                                   ▼
                                shared  ◄──────────────────── everyone may use
                              (layer:shared, depends on nothing)
```

### The rules in words

| Layer            | Tag                    | May import                        |
| ---------------- | ---------------------- | --------------------------------- |
| `shared`         | `layer:shared`         | _nothing_ (only itself)           |
| `domain`         | `layer:domain`         | `shared`                          |
| `application`    | `layer:application`    | `domain`, `shared`                |
| `infrastructure` | `layer:infrastructure` | `application`, `domain`, `shared` |
| `platform`       | `layer:platform`       | `application`, `domain`, `shared` |
| `ui`             | `layer:ui`             | `application`, `shared`           |
| `apps/*`         | `layer:app`            | everything                        |

Key consequences:

- **`domain` and `application` never import a framework, a browser API, a
  database, or a UI library.** They are portable and run in plain Node.
- **`ui` cannot import `infrastructure` or `platform`.** It receives use cases
  through the `UseCasesProvider` (a React context the composition root fills).
- **Only `apps/*` may wire concrete adapters** — the composition root is the one
  place that knows Dexie, Tauri, Capacitor, Cognito, etc. exist together.

> Note on `shared`: the brief says "domain depends on nothing". We treat
> `shared` (Result/Either, branded types, clock contracts) as a zero-dependency
> _foundation_ that every layer including domain may use — the standard
> pragmatic exception. See [ADR-0006](adr/0006-shared-foundation-layer.md).

## Generate the live graph

```bash
pnpm graph                 # opens the interactive Nx project graph
pnpm exec nx graph --file=docs/graph.html   # static export
pnpm exec nx graph --focus=application       # what depends on application
```

`nx graph` reads the real `import` statements, so the picture above can never
drift from the code without CI noticing.
