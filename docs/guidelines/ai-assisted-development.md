# Guideline: AI-assisted development workflow

This architecture is deliberately shaped to be easy for AI agents (and humans) to
work in: small pure functions, explicit dependencies, typed boundaries, and a
no-React execution path. Use the following workflow.

## Why this codebase is AI-friendly

- **Deterministic core.** Domain/application functions take their clock, ids and
  collaborators as parameters, so an agent can run them with fixed inputs and get
  identical outputs every time.
- **Typed ports = unambiguous contracts.** An agent implementing an adapter has
  an exact `type` to satisfy and a contract test that defines "correct".
- **No hidden magic.** No DI container, decorators, or reflection — the whole
  object graph is visible in the composition root.
- **In-memory adapters are a sandbox.** Use cases run against fakes
  (`createInMemoryItemRepository`, `createInMemoryOperationQueue`, the fake
  platform/auth providers) with no backend, native shell, or auth.

## Recommended loop for an agent

1. **Locate the layer.** Map the task to a layer using
   [maintaining-boundaries.md](maintaining-boundaries.md). Business rule →
   `domain`. Orchestration → `application`. I/O → `infrastructure`/`platform`.
   Screen → `ui`.
2. **Write/extend the type first.** New capability ⇒ add or change a port type
   before any implementation.
3. **Drive use cases headlessly with a spec.** Wire the use case to in-memory
   adapters in a Vitest spec (see
   [use-cases.spec.ts](../../libs/application/src/example/use-cases.spec.ts))
   and run `nx test application`. No React, no browser — deterministic execution
   you can assert on.
4. **Prove adapters with contract tests.** New adapter ⇒ register it in the
   relevant contract test and run `nx test infrastructure`.
5. **Exercise UI states with component tests.** Render the screen against mock
   use cases (see
   [item-screen.spec.tsx](../../libs/ui/src/example/item-screen.spec.tsx));
   simulate offline/failure by injecting the in-memory queue or a failing
   `ApiClient`.
6. **Verify the slice.** `nx affected -t lint typecheck test`.

## Prompts/conventions that work well

- "Add a port `X` to `application`, then an in-memory adapter, then make it pass
  the contract test" — maps directly onto the structure.
- Ask the agent to **return `Result`, never throw** in domain/application.
- Ask the agent to **add a use-case spec and a component test** for any new
  feature so its work is runnable and verifiable in isolation.
- Point the agent at the `example` module as the canonical template; consistency
  across features makes generation reliable.

## Guardrails the agent cannot bypass

- ESLint boundary + no-class/decorator rules fail the build on architectural
  violations, so an agent gets immediate, local feedback when it strays.
- `exactOptionalPropertyTypes` + `strict` TS catch a large class of mistakes at
  typecheck time.
