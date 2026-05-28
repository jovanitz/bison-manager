# ADR-0006: `shared` as a zero-dependency foundation usable by `domain`

- Status: Accepted
- Date: 2026-06-05

## Context

The brief states "domain depends on nothing", yet also places `Result/Either`,
logger contracts, and date utilities in `shared`. Taken literally these
conflict: the domain genuinely needs `Result` and the `Clock`/`IdGenerator`
contracts to stay pure and deterministic.

## Decision

Treat `shared` as a **foundation layer that itself depends on nothing** and that
*every* layer — including `domain` — may import. The boundary rule for
`layer:shared` allows only `layer:shared`; `layer:domain` allows
`layer:domain` + `layer:shared`.

To preserve the spirit of "domain depends on nothing", `shared` is restricted to
framework-free, side-effect-free primitives: types, `Result`, branded types,
tagged-error helpers, and *contracts* (not implementations) for `Logger`/`Clock`.

## Consequences

- The domain stays pure and deterministic while reusing the same `Result` and
  error vocabulary as the rest of the system.
- `shared` must remain disciplined: nothing that imports React, the DOM, a
  database, or a platform SDK is ever allowed in it (guarded by the boundary
  rule and code review).
