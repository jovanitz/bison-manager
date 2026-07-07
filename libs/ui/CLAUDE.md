# libs/ui — `layer:ui`

Design system + feature screens. **May import `application` and `shared` only.**

- **Holds:** design-system components (shared by ALL giros), feature screens +
  **stores** organized product-first — `src/<product>/<app>/…` per
  [screens.md](../../docs/ai/screens.md) (giro-specific UI never leaves its
  `src/<giro>/` dir — ADR-0017; `src/client` + `src/dashboard` are the existing
  giro's legacy pre-namespace screens), and DI wiring for React
  (`src/{design-system,example,di}`).
- **Forbidden:** `infrastructure`, `platform`, **and `domain`**. A screen never
  news up an adapter and never imports the DB/native APIs.
- **Pattern (one-way flow — see [flows.md](../../docs/ai/flows.md)):**
  - A **component reads a ViewModel** from a store selector and **dispatches
    actions**. It holds NO orchestration: no `Promise.all`, no deriving `canX`,
    no building a permission set, no choosing which use case to call.
  - A **store** (Zustand) is a thin reactive cache + dispatch; each action just
    calls a headless **controller** in `application/flows` and `set(...)`s the
    result. Build it from the DI bundles in the app's `store/hooks.ts` (the ONLY
    place that reads `useUseCases`).
  - Cross-module orchestration lives in the controller, **never** in a component
    or a store. If a component decides anything beyond what to render, move it down.
  - Test components against the same DI mocks — the store reads them, so specs
    stay behavior-level. See
    [client/manage-org/manage-org-section.spec.tsx](src/client/manage-org/manage-org-section.spec.tsx).
  - State libs: Zustand for the flow stores; TanStack Query only for pure
    high-frequency reads; React Hook Form + Zod for forms.

Template (one-way slice): [client/manage-org](src/client/manage-org) +
[client/store](src/client/store) · DI: [src/di](src/di).
