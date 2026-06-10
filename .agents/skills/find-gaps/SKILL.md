---
name: find-gaps
description: Audit the Acme codebase for development gaps — untested adapters, use cases without specs, screens without component tests, untested domain logic, and TODO/FIXME markers. Use when the user asks "what's missing", "what's untested", "audit this feature", "are there gaps", "what needs tests", or before considering a feature complete.
---

# find-gaps

Find gaps that this Clean+Hexagonal architecture makes mechanically detectable
(e.g. a port adapter with no contract test). Runs statically — no test execution
— so it is fast and safe to run often.

## How to run

```bash
pnpm harness gaps              # whole repo
pnpm harness gaps --layer=infrastructure   # one layer only
```

Output is JSON on stdout:

```jsonc
{ "tool":"gaps", "ok":false,
  "summary": { "total": 9, "byType": {...}, "bySeverity": {"high":9} },
  "gaps": [ { "type","severity","layer","file","message","suggestion" } ] }
```

## How to interpret

- **`ok: false`** means at least one **high**-severity gap exists. Treat high
  gaps as blockers for "done".
- Gap types and the fix each implies:
  - `untested-adapter` (high) → register the adapter in its contract test
    (`infrastructure/src/testing/*-contract.ts`) and add a `.spec` that runs it.
  - `untested-use-case` (high) → add a headless Vitest spec against in-memory
    adapters (see `application/src/example/use-cases.spec.ts`).
  - `untested-screen` (medium) → add a `*-screen.spec.tsx` against mock use cases.
  - `untested-domain` (medium) → add a `.spec.ts` for the rules/value objects.
  - `todo` (low) → resolve or convert into a tracked task.

## What to do with the result

1. Report the summary first (totals by severity), then list high-severity gaps.
2. Do **not** silently fix everything — confirm scope with the user; gaps may be
   intentional (e.g. native adapters stubbed for CI).
3. After adding tests, re-run `pnpm harness gaps` to confirm the gap closed.

See [docs/ai/sensors.md](../../../docs/ai/sensors.md) for the full tool catalog.
