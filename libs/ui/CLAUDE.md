# libs/ui — `layer:ui`

Design system + feature screens. **May import `application` and `shared` only.**

- **Holds:** design-system components, feature screens, DI wiring for React
  (`src/{design-system,example,di}`).
- **Forbidden:** `infrastructure`, `platform`, **and `domain`**. A screen never
  news up an adapter and never imports the DB/native APIs.
- **Pattern:**
  - Screens consume **use cases** received through the `UseCasesProvider` React
    context (filled by the app's composition root) — never import a use case's
    concrete dependencies.
  - Test screens against **mock use cases**; simulate offline/failure by injecting
    a failing `ApiClient` or the in-memory queue. See
    [src/example/item-screen.spec.tsx](src/example/item-screen.spec.tsx).
  - State: Zustand for local UI state, TanStack Query for server cache, React Hook
    Form + Zod for forms.

Template: [src/example/item-screen.tsx](src/example/item-screen.tsx) ·
DI: [src/di](src/di).
