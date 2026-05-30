# ADR-0003: Result/Either for expected failures

- Status: Accepted
- Date: 2026-06-05

## Context

Business operations fail in expected ways (invalid input, not found, rule
violations). Modelling these as thrown exceptions hides them from the type
system, makes control flow implicit, and is easy to forget to handle.

## Decision

Use a `Result<T, E>` (`Ok | Err`) type from `@acme/shared` for all _expected_
failures in `domain` and `application`. Errors are **tagged, immutable data**
(`TaggedError`), not exceptions — serializable and pattern-matchable.

Throwing is reserved for genuinely unexpected, programmer-error conditions.
Adapters may throw at the I/O boundary (network/disk); those are caught at the
edge (e.g. TanStack Query's `mutationFn` converts `Err` to thrown for its retry
machinery, and infra errors surface as query errors).

## Consequences

- The compiler forces callers to handle both branches — failures cannot be
  silently dropped.
- Domain/application functions are total and deterministic.
- Slightly more verbose call sites (`if (!r.ok) return …`). Helpers (`map`,
  `flatMap`, `all`) reduce the noise; the explicitness is the point.
