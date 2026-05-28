# ADR-0005: Composition roots instead of a DI container

- Status: Accepted
- Date: 2026-06-05

## Context

Dependencies must be injected, but DI containers rely on decorators/reflection
(banned by ADR-0002) and obscure the wiring behind runtime magic.

## Decision

Each app owns a **composition root** — a single module
(`apps/<app>/src/composition-root.ts`) that constructs concrete adapters and
passes them, by hand, into use-case factories. The result (a `…Runtime` object
holding `useCases`, `platform`, `sync`) is handed to the UI tree once at startup.

No container, no service locator, no reflection, no decorators. Wiring is just
function calls with explicit arguments.

## Consequences

- The entire object graph of an app is readable top-to-bottom in one file.
- Per-app composition roots are how platforms differ: web/mobile/desktop share
  use cases and UI, and vary only in which adapters they wire.
- The same pattern makes test setups trivial: a test "composition root" wires
  in-memory/fake adapters, so "real vs mock vs failing" is a one-line swap.
- Wiring is manual. For large graphs this file grows; we keep it flat and split
  by feature when needed rather than reaching for a container.
