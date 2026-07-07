# AI context — File & folder structure (clean, small, screaming)

Goal: code a human can read at a glance. Small files, shallow folders named after
**what the software does** (features), and limits that are enforced — not just
suggested. The `structure` sensor and the ESLint clean-code rules back this doc.

## Screaming architecture

Folders should scream the **domain/feature**, not the framework. Inside each layer
(`docs/ai/architecture.md`), group by feature, not by technical kind.

```
libs/domain/src/
  order/            ← a feature screams from the folder name
    order.ts
    value-objects.ts
    events.ts
    errors.ts
    index.ts
  invoice/
    ...
```

- A feature is a folder; its files are the pieces of that feature.
- The layer still decides _what kind_ of code lives there (rules in `domain`,
  use cases + flows in `application`, adapters in `infrastructure`/`platform`,
  screens + stores in `ui`); the **feature folder** decides _which_ slice.
- `shared` is the exception: small cross-cutting utilities live flat.

## Enforced limits

| Limit                            | Value                              | Enforced by                                 |
| -------------------------------- | ---------------------------------- | ------------------------------------------- |
| File length                      | ≤ 200 lines (excl. blank/comments) | ESLint `max-lines` (error)                  |
| File length (raw backstop)       | ≤ 250 raw lines                    | `structure` sensor (blocks gate)            |
| Files per folder                 | ≤ 8                                | `structure` sensor (blocks gate)            |
| Function length                  | ≤ 70 lines                         | ESLint `max-lines-per-function`             |
| Cyclomatic complexity            | ≤ 10                               | ESLint `complexity`                         |
| Cognitive complexity             | ≤ 15                               | `sonarjs/cognitive-complexity`              |
| Nesting depth                    | ≤ 3                                | ESLint `max-depth`                          |
| Parameters                       | ≤ 4                                | ESLint `max-params` (use an options object) |
| Duplication, dead branches, etc. | —                                  | `eslint-plugin-sonarjs`                     |

Run them: `pnpm harness quality` (lint) + `pnpm harness structure`. Both are part
of the Stop guardrail, so a violation blocks "done".

## When a file or folder grows

- **File > limit** → split by responsibility. Extract helpers/value objects into
  sibling files in the same feature folder (e.g. `order/pricing.ts`).
- **Folder > 8 files** → introduce subfolders. Either split the feature
  (`order/` → `order/pricing/`, `order/fulfillment/`) or move sub-concepts down.
- **Function > 70 / too complex** → extract named helper functions. Prefer many
  small pure functions over one big one.

## App naming (giros)

New giro apps are named `<giro>-<app>` (e.g. `girob-api`, `girob-dashboard`).
The unqualified names (`api`, `dashboard`, `client`, `web`, `mobile`,
`desktop`) are legacy names owned by the EXISTING giro — never mint new
unqualified app names (ADR-0017; Nx project names are workspace-unique).

## Exemptions (deliberate)

- **Composition roots** (`apps/*/composition-root.ts`): wiring is assembly —
  function-length cap is off.
- **Fakes** (`**/fake/**`) and **tests/contracts** (`*.spec.*`, `**/testing/**`,
  `*.bench.ts`): setup/fixtures are repetitive by nature — size & duplication
  rules are relaxed.

These exemptions live in `eslint.config.mjs`; everything else is held to the bar.
