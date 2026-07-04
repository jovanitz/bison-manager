# Building screens (views) — prototype first, implement later

> **Read this first.** **Designing / building a view is ONLY a prototype.**
> It is fake data + a click-through of the UI (happy AND unhappy paths) composed
> from the design system. It is **NOT the app** and it wires to **NO** real
> logic. **Implementation** — connecting the view to real stores / use cases /
> backend — is a **separate thing**, done later and only when explicitly asked.
> Do not blur the two: "arma/diseña la vista" = prototype; "impleméntala" =
> implementation.

A **view** is a screen's UI. We keep prototype and implementation apart with
**two phases**, so the prototype work is never thrown away when functionality
arrives. The `screens` sensor enforces this (`pnpm harness screens`, part of the
blocking `check` gate).

## The seam that makes it zero-rework

A view is a **pure function of `(ViewModel + actions)`**, both received as props,
composing the design system. Nothing else. That single contract is what lets us
design the UI now and wire it later **without touching the view**.

```tsx
// directory.view.tsx  —  @phase draft
/** Directory · @phase draft */
type DirectoryVM = {
  readonly rows: readonly MemberRow[];
  readonly loading: boolean;
  readonly empty: boolean;
  readonly error?: string;
  readonly canInvite: boolean; // ← DATA, not computed in the component
};
type DirectoryActions = {
  readonly onInvite: () => void;
  readonly onSearch: (q: string) => void;
};
export const DirectoryView = (
  props: { readonly vm: DirectoryVM } & DirectoryActions,
) => {
  /* compose DS: DataTable, Button, EmptyState, Skeleton… */
};
```

**Golden rule:** the view _renders_ state, it never _computes_ it. `canInvite`,
`loading`, `error` are fields on the ViewModel. Permissions, `Promise.all`,
deriving `canX`, choosing a use case — none of that lives in the view (it moves
to the controller in phase 2).

## The two phases

### Phase 1 — `draft` = **PROTOTYPE** (design) · “arma / diseña la vista X”

Pure UI, **fake data, no real logic** — this is prototyping, not the app:

- `<name>.view.tsx` — presentational, `(vm, actions)`, composes the DS.
- `<name>.view.stories.tsx` — mock ViewModels for **every** state, **happy AND
  unhappy** (loading / empty / error / denied / populated). Design + approve
  here, verify responsive (~375/768/1280).
- Optional: a **navigable prototype** stitches several draft views into a
  clickable mockup (see below) — still fake data, still no logic.
- **No** stores, use cases, DI, or `@acme/application` — the view imports the
  design system and `react`, nothing architectural.

### Phase 2 — `approved` = **IMPLEMENTATION** (a separate thing) · “X quedó aprobada, impleméntala / cabléala”

A **different** activity from prototyping — real logic enters here. Only after
visual sign-off and only when explicitly asked. Build inside-out, view **frozen**:

`port → use case → adapter → store (Zustand) → controller (application/flows) →
<name>.container.tsx`

The **container** selects the real ViewModel from the store and passes the
actions to `<name>.view.tsx`. The view file does not change — that is the payoff.

## The phase marker (machine-readable source of truth)

Each view carries a tag in its top JSDoc; the harness reads it:

```tsx
/** Directory · @phase draft */ // being designed
/** Directory · @phase approved */ // signed off, wired
```

Flipping `draft → approved` is the **approval act** — a deliberate, reviewable
change in git. It is what switches the enforced rule set.

## Request vocabulary (human → agent)

| You say                                     | Phase                | The agent does                                                           |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| “arma / diseña la vista X”                  | draft · prototype    | `view.tsx` + `view.stories.tsx` (mocks), `@phase draft`, no architecture |
| “ajusta / itera la vista X”                 | draft · prototype    | edits view + stories only                                                |
| “X quedó aprobada, impleméntala / cabléala” | approved · implement | flip to `@phase approved` + wire inside-out; view frozen                 |
| “reabre X a draft”                          | draft · prototype    | flip back to touch the UI again                                          |

**Never implement (wire real logic) while designing.** A prototype request never
authorizes touching stores/use cases/backend; that is a separate, explicit
"impleméntala".

Guardrails: a “wire it” request on a still-`draft` view → the agent confirms
(flip to approved?) before starting architecture; a layout change on an
`approved` view → asks for an explicit “reopen to draft” first.

## What the `screens` sensor enforces

`pnpm harness screens` (blocking gate). For every `*.view.tsx`:

- must carry a valid `@phase draft|approved`;
- must have a `*.view.stories.tsx`;
- must **not** import architecture (`@acme/application|domain|infrastructure|
platform`, `/di/`, `use-cases-context`, `*.store`) — presentational in **both**
  phases;
- `approved` → must have a `*.container.tsx` (the wiring seam);
- `draft` with a container → warning (you’re wiring the unapproved).

Config knob: `screens` in [harness.config.mjs](../../harness.config.mjs). Template
slice (one-way flow): [libs/ui/src/client/manage-org](../../libs/ui/src/client/manage-org)

- [libs/ui/src/client/store](../../libs/ui/src/client/store). See also
  [flows.md](flows.md) for the UI → Store → Controller → Use case → Domain rule.

## Organization — by product (giro), then app, then feature

Views are grouped by **product / giro** first (e.g. Medicine Manager), because a
product ships **several apps** (a dashboard + N apps). The design system stays
one shared layer above all products. Three levels:

**`<product>/<app>/<feature>`** — folder in kebab-case, Storybook title in Title
Case. States (loading/empty/error/…) are the story **exports**, not title levels.

```
libs/ui/src/
  design-system/                          → "Design System/*"        (shared, all products)
  medicine-manager/                       ← product / giro
    dashboard/
      directory/directory.view.tsx        → "Medicine Manager/Dashboard/Directory"
      directory/directory.view.stories.tsx
    <other-app>/<feature>/…               → "Medicine Manager/<App>/<Feature>"
  <other-product>/<app>/<feature>/…       → "<Product>/<App>/<Feature>"
```

- **Design system** = shared primitives/composites → `libs/ui/src/design-system/**`,
  `Design System/*`. Reused by every product.
- **Views** = product-scoped compositions → `libs/ui/src/<product>/<app>/<feature>/<feature>.view.tsx`,
  titled **`<Product>/<App>/<Feature>`**.

Sidebar order is pinned in [.storybook/preview.ts](../../libs/ui/.storybook/preview.ts)
(`options.storySort` → `['Design System', '*']`: DS first, products alphabetical).
The stories glob already covers `libs/ui/src/**`, so a new product/app/view shows
up automatically once its `title` follows `<Product>/<App>/<Feature>`.

Branding: brand is a _product/app_ choice (its `.brand-*` preset). A view can
default to it with `parameters: { globals: { brand: 'violet' } }`; the toolbar
still previews any brand. The `screens` sensor scans all of `libs/ui/src`, so it
governs every product's views identically — no per-product config.

## Working method — re-skin the implemented base, section by section

There is already an **implemented base**: the staff dashboard in
[libs/ui/src/dashboard](../../libs/ui/src/dashboard) (login/gate, accounts,
invitations, roles, permissions, block, audit, settings) — fully wired to its
stores + flows + use cases. Its UI is a **skeleton**. The plan is to
**re-express that base with the design system**, and then grow new UI — always
**one section at a time, only when explicitly asked**.

**Hard rules for this work (do NOT deviate):**

- **No giant steps.** Do exactly the one section requested. Never scaffold ahead
  (multiple sections/views at once), never bulk-move folders, never invent
  content or features that aren't in the implemented base.
- **The base is the source of truth for the ViewModel.** Before building a
  section's view, read its existing implemented screen to learn what data and
  actions it really needs, so the `ViewModel + actions` match reality — that is
  what keeps wiring zero-rework.
- **Wait for the request.** Josh drives section by section ("diseña la vista de
  <sección>"); build that one, verify, stop.

**Per-section recipe:**

1. Look at the implemented screen in `libs/ui/src/dashboard/<section>` (+ its
   store) to derive the real `ViewModel` + actions.
2. Build `medicine-manager/dashboard/<section>/<section>.view.tsx` presentational
   (DS, `@phase draft`) + stories with mock VMs for each state. Verify + stop.
3. On approval → wire to the **existing** store/flow (no new backend needed).

## Navigable prototype — a clickable mockup, still just a prototype

Once several draft views exist you can stitch them into a **navigable
prototype**: click the sidebar to switch sections, click an organization to open
its detail, back, etc., and **simulate happy AND unhappy paths** (a section that
errors, an org whose members are hidden, an empty list…). It is **still a
prototype**: fake data, unimplemented flows, no real logic — its only job is the
click-through. It is not the app.

The navigation itself is plain UI (state in the prototype container), so wiring
it costs nothing and does not leak into the pure views.

**How (keeps the views pure):**

- The **views stay pure** (`fn(ViewModel + actions)`), `@phase draft`.
- A thin **prototype container** — `*.prototype.tsx`, NOT a `.view.tsx` (so the
  `screens` sensor ignores it) — holds the navigation state (`section`,
  `selectedId`), renders the shell + the active view fed with **fixtures**, and
  wires the navigation actions.
- **Navigation actions are real** (sidebar → section, row → detail, back);
  **mutating actions are no-ops** (`() => undefined`) for now.
- The shell exposes navigation via an **optional** prop (e.g. `onNavigate?`), so
  existing per-view stories that omit it still work.
- **Fixtures** live in a sibling `*.prototype.fixtures.tsx` (reuse a section's own
  fixtures where they exist).

Host it in a **Storybook story** (fastest, zero setup) or, when you need a
shareable URL for a demo, a `/prototype` route in a real app shell.

(Implementation is a separate concern: standing up the real app later swaps
fixtures for store-fed data and moves navigation into the router — the pure views
don't change. That's a bonus, not the point of the prototype.)

Example: [medicine-manager/dashboard/prototype](../../libs/ui/src/medicine-manager/dashboard/prototype)
(`dashboard.prototype.tsx` + `.fixtures.tsx` + `.stories.tsx`).
