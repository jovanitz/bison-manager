# ADR-0001: Clean + Hexagonal architecture in an Nx monorepo

- Status: Accepted
- Date: 2026-06-05

## Context

We need one architecture to serve many products across web, PWA, iOS, Android,
Windows and macOS, with maximum code reuse and long-term maintainability. The
single biggest threat to reuse is business logic that is entangled with React,
the browser, a database, or a platform SDK.

## Decision

Adopt Clean Architecture / Hexagonal (Ports & Adapters) with concentric layers,
each a separate Nx library:

- `domain` — entities, value objects, domain rules/events (the core).
- `application` — use cases + **ports** (the abstractions the core needs).
- `infrastructure` / `platform` — **adapters** that implement the ports.
- `ui` — presentation that consumes use cases.
- `shared` — zero-dependency foundation.
- `apps/*` — composition roots that wire adapters to use cases.

Dependencies point **inward** (Dependency Inversion): outer layers depend on the
abstractions defined by inner layers, never the reverse. Enforced by Nx tags +
`@nx/enforce-module-boundaries`.

## Consequences

- Business logic is portable and runs in plain Node — testable without a browser
  and reusable in every app.
- Swapping a database, API protocol, auth provider, or platform is a
  composition-root change, not an application change.
- More indirection up front (ports + adapters). We accept this; it is the price
  of platform independence and is mechanical/AI-friendly to follow.

## Alternatives considered

- **Feature-sliced front-end only** — simpler, but couples logic to React and
  does not give us a Node-executable core for mobile/desktop reuse.
- **Per-platform apps with shared utils** — leads to duplicated business logic.
