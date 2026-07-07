# AI context — Flows: unidirectional UI, headless orchestration

Read this before touching a **screen** or adding **cross-module orchestration**.
It defines the one-way data flow and where each piece lives. The point: the UI
holds no business/flow logic, so the same orchestration a screen drives can be
driven by a future MCP server (an AI giving instructions) with no change.

## The one-way flow

```
UI component → Store → Controller (flow) → Use case → Domain
   reads VM      dumb      headless          atomic     pure
   dispatches    cache     orchestration
```

- **UI component** (`libs/ui`): reads a **ViewModel** via a store selector and
  **dispatches actions**. No `Promise.all`, no deriving `canX`, no building a
  permission set, no "which use case do I call" — none of it. If a component
  decides anything beyond "what to render", that logic is in the wrong place.
- **Store** (`libs/ui`, Zustand): a thin reactive cache of the ViewModel +
  `loading`/`error`, exposing actions that **delegate to a controller**. The
  store owns no orchestration — every action is a few lines that call a flow and
  `set(...)` the result.
- **Controller / flow** (`libs/application/src/flows`): **headless** orchestration.
  Composes use cases / client gateways, builds the ViewModel, applies UI-facing
  policy (capability flags, default grants, permission-set mutation). Pure
  functions with **deps passed explicitly** — no React, no browser, no Zustand.
  This is the single source of flow logic.
- **Use case** (`libs/application`): one capability (atomic), returns `Result`.
- **Domain**: rules.

Authorization always stays server-side; capability flags (`holdsAction`,
`isPlatformAdmin` in `flows/capabilities.ts`) only decide what to _hide_.

## Why headless: the MCP payoff

Each controller is registered in an **enumerable catalog** (`CLIENT_FLOWS`,
`DASHBOARD_FLOWS` — per app OF A GIRO; a new giro's apps add their own
catalogs, ADR-0017) — `{ name, kind: 'query'|'command', input: ZodSchema, run }`.
A UI store calls the typed controller directly; a future MCP app (one per giro)
iterates the registry to expose **one tool per entry** (read `name`, derive a
JSON schema from `input`, validate, `run`). Same brain, two front-ends. So
orchestration that leaks into a component is orchestration the MCP can't
reuse — that's the test.

## Rules (enforced or to-be-enforced)

- **`application` is framework-free** — no React, no state libs (Zustand). The
  store lives in `ui` because it is the reactive binding; the controller never is.
  (Lint bans `react`/`zustand` in `libs/application`, like `domain`.)
- **Components don't orchestrate.** Cross-module composition goes in a controller,
  never in a component and never inside the store.
- **A controller takes deps explicitly** (`OrgAdminDeps`, `DashboardFlowDeps`…) so
  both the UI (via a store) and the MCP (direct) inject them.
- **Every controller is enumerable** — add new flows to the matching registry.

## Build order (extends workflow.md)

domain → use case (spec) → **controller + ViewModel + registry entry (spec, incl.
a mock-MCP run by name)** → **dumb store** → component (reads VM, dispatches) →
wire in `apps/*`.

## Canonical example (copy its shape)

- controllers: [libs/application/src/flows/client/org-admin.ts](../../libs/application/src/flows/client/org-admin.ts) ·
  registry: [libs/application/src/flows/client/registry.ts](../../libs/application/src/flows/client/registry.ts) ·
  mock-MCP proof: [registry.spec.ts](../../libs/application/src/flows/client/registry.spec.ts)
- store: [libs/ui/src/client/store/org-admin-store.ts](../../libs/ui/src/client/store/org-admin-store.ts) ·
  binding: [store/hooks.ts](../../libs/ui/src/client/store/hooks.ts)
- component: [manage-org-section.tsx](../../libs/ui/src/client/manage-org/manage-org-section.tsx) (render + dispatch only)

## File layout

```
libs/application/src/flows/{capabilities,registry-types}.ts
libs/application/src/flows/<area>/{<feature>.ts, registry.ts, *.spec.ts}
libs/ui/src/<product>/<app>/store/{<feature>-store.ts, hooks.ts}   # product-first, see screens.md

```
