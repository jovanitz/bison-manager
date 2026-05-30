# Guideline: Maintaining architectural boundaries

The boundaries are enforced mechanically. Your job is to keep them honest and to
know what to do when the linter pushes back.

## How enforcement works

- Every project has one `layer:*` tag in its `project.json`.
- `@nx/enforce-module-boundaries` (in `eslint.config.mjs`) defines which tag may
  import which. A bad import fails `nx lint`.
- `libs/domain` has extra `no-restricted-imports` rules banning React, Dexie,
  state libs and platform SDKs outright.
- A global `no-restricted-syntax` rule fails the build on `class`/decorators.

## Common violations and the fix

| Symptom                                      | Why it's blocked                   | Fix                                                                                             |
| -------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ui` imports `@acme/infrastructure`          | UI must not know concrete adapters | Add a use case + read it from `UseCasesProvider`                                                |
| `application` imports `@acme/infrastructure` | Inner can't depend on outer        | Define a **port** in `application`; implement in `infrastructure`; wire in the composition root |
| `domain` imports `dexie`/`react`             | Domain must be portable            | Move the concern behind a port; pass data in/out as plain values                                |
| Need `Date.now()` in a use case              | Hidden non-determinism             | Inject the `Clock` port and call `clock.now()`                                                  |
| Wrote a `class Repository`                   | ADR-0002                           | Convert to a `create…` factory returning a plain object                                         |

## Reviewer checklist

- [ ] New project tagged with the correct single `layer:*`.
- [ ] No new dependency arrow that the graph forbids (`nx graph` to verify).
- [ ] Ports defined in `application`/`platform`, implementations in
      `infrastructure`/`platform`.
- [ ] No concrete adapter imported outside a composition root.
- [ ] Contract tests cover any new adapter of an existing port.

## Visualize

```bash
pnpm graph                         # whole graph
pnpm exec nx graph --focus=ui      # what ui can reach
```
