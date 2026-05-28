# ADR-0002: Functional core — no classes, decorators, or OOP-heavy patterns

- Status: Accepted
- Date: 2026-06-05

## Context

The brief mandates pure functions, immutable data, and object composition, and
explicitly bans classes, decorators, service locators, and singleton-heavy
patterns. We want code that is easy to reason about, test, tree-shake, and that
AI agents can generate and modify reliably.

## Decision

- Model behaviour as **pure functions** and data as **immutable, `readonly`
  records**. Entities are plain objects; "mutations" return new objects.
- Build collaborators with **factory functions** that return plain objects
  (`createInMemoryItemRepository`, `makeCreateItem`), never `class … {}`.
- Inject dependencies as **explicit parameters** (the `deps` bundle), not via
  containers, decorators, or reflection.
- Use **branded types** for value-object identity instead of class instances.

A lint rule (`no-restricted-syntax` on `ClassDeclaration`/`Decorator`) makes
violations fail CI. The `domain` library has additional `no-restricted-imports`
rules forbidding React, persistence, and platform SDKs.

## Consequences

- Trivial testability: pass fakes as parameters, no mocking framework needed.
- No hidden global state, no `this` ambiguity, better tree-shaking.
- Some patterns people expect (DI containers, class repositories) are simply
  absent. Newcomers must learn the factory-function idiom; the guidelines and
  the consistent ExampleModule make this fast.
