# ADR-0009: Nx monorepo with tag-based boundary enforcement

- Status: Accepted
- Date: 2026-06-05

## Context

The architecture only delivers value if its boundaries hold over time. Verbal
conventions rot; we need them mechanically enforced, plus fast CI as the repo
grows.

## Decision

Use an **Nx + pnpm** monorepo. Every project carries exactly one `layer:*` tag
in its `project.json`. `@nx/enforce-module-boundaries` encodes the allowed
dependencies between tags (see [dependency-graph.md](../dependency-graph.md)); a
violation fails `nx lint`.

CI uses `nx affected` (only touched projects run) plus the Nx computation cache
and `nrwl/nx-set-shas` for incremental, fast pipelines. TypeScript path aliases
(`@acme/*`) give clean imports; the live graph comes from `nx graph`.

## Consequences

- Architectural drift becomes a failing build, not a code-review opinion.
- CI scales sub-linearly with repo size thanks to affected + caching.
- Contributors must tag new projects correctly and respect `@acme/*` import
  paths; the feature/platform guidelines cover this.
