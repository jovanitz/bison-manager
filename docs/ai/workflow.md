# AI context — The feature loop

How to build a vertical slice in this codebase. This is the inside-out order the
architecture is optimised for; following it keeps every step runnable and
verifiable in isolation. The deeper rationale is in
[ai-assisted-development.md](../guidelines/ai-assisted-development.md).

Work **test-first (red → green → refactor)** and model with **DDD** tactical
patterns — see [methodology.md](methodology.md). The `gaps` gate blocks finishing
if a use case or adapter has no test.

## The loop

1. **Locate the layer.** Map the task with
   [architecture.md](architecture.md). Rule → `domain`. Orchestration →
   `application`. I/O → `infrastructure`/`platform`. Screen → `ui`.

2. **Type first.** A new capability means adding/changing a **port type** in
   `application` _before_ any implementation. The type is the contract.

3. **Drive use cases headlessly.** Wire the use case to in-memory adapters in a
   Vitest spec (see
   [use-cases.spec.ts](../../libs/application/src/example/use-cases.spec.ts)) and
   run `nx test application`. No React, no browser — deterministic, assertable.

4. **Prove adapters with contract tests.** A new adapter must satisfy the same
   contract test as the in-memory one. Register it and run
   `nx test infrastructure` (or `platform`).

5. **Exercise UI states.** Render the screen against mock use cases (see
   [item-screen.spec.tsx](../../libs/ui/src/example/item-screen.spec.tsx));
   simulate offline/failure by injecting the in-memory queue or a failing
   `ApiClient`.

6. **Wire it.** Add the concrete adapter in `apps/*/composition-root.ts`. This is
   the only place the slice becomes "real".

7. **Verify & evaluate.** Run the quality gate (`pnpm harness quality`), then use
   the other **sensors** in [sensors.md](sensors.md) (`impact`, `perf`, `gaps`) to
   check reach, performance and gaps before declaring done.

8. **Validate at runtime (complex / user-facing tasks only).** If the task changes
   user-observable behavior (a flow, screen, routing, auth, data rendering), prove
   it in a real browser **before delivering**: write/extend an `e2e` that drives it
   as a user and asserts on internal state via the bridge (`window.__app__`), then
   run `pnpm harness e2e`. Use the **verify-runtime** skill — it's opt-in (mark with
   `.harness/require-e2e`), and the Stop hook reminds you if you forget. Pure
   `domain`/`application` changes skip this (unit/contract tests suffice).

> **Sensitive feature?** (auth, tokens, permissions, payments) Don't use
> `generate-feature` (CRUD-only). Follow [security.md](security.md) and run
> `/security-review` before merging.

## Why this works for an agent

- **Deterministic core.** Functions take their clock/ids/collaborators as
  parameters → same input, same output, every run.
- **In-memory adapters are a sandbox.** `createInMemory*` fakes let you run use
  cases with no backend, native shell, or auth.
- **Typed ports = unambiguous "correct".** The port type plus its contract test
  define done; there's nothing to guess.

## Prompts that map cleanly onto the structure

- "Add port `X` to `application`, then an in-memory adapter, then make it pass the
  contract test."
- "Add a use-case spec and a component test for this feature."
- "Use the `Item` example as the template" — consistency makes generation reliable.
