---
name: evaluate-quality
description: Run the Acme quality gate — lint + typecheck + test on affected projects — and report pass/fail. Use before declaring work done, when the user asks "is it green", "does it pass", "run the checks/gate/tests", or to confirm a change is safe. The same gate is also enforced automatically by the Stop hook.
---

# evaluate-quality

Runs the quality gate as a **sensor** you can invoke at any time (the Stop hook
also runs it as a guardrail before finishing — see
[docs/ai/harness.md](../../../docs/ai/harness.md)). Single source of logic:
`scripts/harness/sensors/quality.mjs`.

## How to run

```bash
pnpm harness quality          # lint + typecheck + test on AFFECTED projects (fast)
pnpm harness quality --all    # the whole monorepo (use sparingly)
```

Output is JSON on stdout:

```jsonc
{ "tool":"quality", "ok":true, "mode":"affected",
  "targets":["lint","typecheck","test"], "durationMs":1234,
  "output":"" }   // on failure, `output` holds the captured failure log
```

## How to interpret

- **`ok: true`** → the gate is green; the slice is safe to call done.
- **`ok: false`** → read `output` for the failing target(s) and fix them, then
  re-run. Do not declare the work done while the gate is red.
- **`mode`** is normally `affected`; it falls back to `run-many` if no git base can
  be resolved.

## What to do with the result

1. Run this before saying a task is complete.
2. On failure, fix and re-run until `ok: true` — the Stop hook will block finishing
   otherwise.
3. To scope what the gate will touch, pair with `pnpm harness impact`.

See [docs/ai/sensors.md](../../../docs/ai/sensors.md) for the full sensor catalog.
