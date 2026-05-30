# AI context — Hard constraints (what you may NOT do)

These are **non-negotiable**. Most are mechanically enforced; the build fails if
you break them. Treat anything here as a wall, not a guideline.

## Enforced by lint/typecheck (the build will fail)

1. **No cross-layer imports against the arrows.** See
   [capabilities.json](capabilities.json). E.g. `ui` importing `infrastructure`,
   or `domain` importing `application`, fails `nx lint`.
2. **No classes, no decorators.** Model with pure functions, plain data, and
   factory functions. (ADR-0002)
3. **`strict` TypeScript**, plus `exactOptionalPropertyTypes`,
   `noUncheckedIndexedAccess`-style rigor, `noUnusedLocals/Parameters`,
   `noImplicitReturns`. Code that doesn't typecheck doesn't merge.
4. **Clean-code limits** (ESLint + `eslint-plugin-sonarjs` + the `structure`
   sensor): file ≤ 200 lines, function ≤ 70, complexity ≤ 10, cognitive ≤ 15,
   depth ≤ 3, params ≤ 4, **≤ 8 files per folder**. Keep files small and folders
   organized by feature (screaming architecture). See
   [structure.md](structure.md).

## Enforced by convention + review (don't rely on the model "remembering")

4. **Return `Result`/`Either`, never `throw`** for expected failures in `domain`
   and `application`. Exceptions are for programmer bugs only. (ADR-0003)
5. **`domain` and `application` import nothing from the outside world**: no
   React, no `window`/`document`, no Dexie, no `fetch`/HTTP client, no auth SDK,
   no Capacitor/Tauri. If you reach for one, you need a **port** instead.
6. **Ports are `type`s; adapters are factory functions** (`createXxx(...) =>
Port`). No interfaces-as-classes, no inheritance. (ADR-0004)
7. **Dependency injection is explicit parameters.** No DI container, no service
   locator, no global singletons. The whole object graph is visible in
   `apps/*/composition-root.ts`. (ADR-0005)
8. **Only `apps/*` know concrete adapters exist together.** Don't import Dexie in
   `ui`, don't import Tauri in `application`, etc.
9. **Native imports are isolated.** Capacitor/Tauri imports live only in the
   per-app `native-*.ts` file (stubbed for CI). Don't scatter them.
10. **Feature-module exports must embed the entity token.** A symbol that belongs
    to a feature (`Item`/`Order`/…) must carry its name — `isItemEditable`,
    `ItemUseCaseResult` — never a bare generic name. Genuinely-generic types
    (e.g. `ListOptions`) live in the shared kernel (`libs/application/src/ports/`),
    defined once and imported, **not** redefined per feature. Otherwise two
    features export the same name and break the barrel `export *`. This is what
    lets `pnpm harness generate-feature` scale.

## Definition of done (a change is not "done" until)

- [ ] New capability added a **port type** in `application` before any adapter.
- [ ] Use case has a **headless spec** (in-memory adapters, `nx test application`).
- [ ] New adapter is registered in the relevant **contract test**.
- [ ] New/changed screen has a **component test** against mock use cases.
- [ ] `pnpm exec nx affected -t lint typecheck test build` is green.

If you are unsure whether something is allowed, check
[capabilities.json](capabilities.json) or ask — do not guess and break a wall.
