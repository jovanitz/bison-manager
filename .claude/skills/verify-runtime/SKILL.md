---
name: verify-runtime
description: For complex or user-facing tasks, validate the running app in the browser before delivering — drive it as a user and inspect internal runtime state/errors via the debug bridge. Use when a task changes behavior (a flow, screen, routing, auth, data rendering), when the user asks to "validate in runtime / verify it actually works / check the running app", or before declaring a complex behavioral task done.
---

# verify-runtime

Some tasks aren't proven by unit/contract tests alone — they need to be exercised
in a real browser, with the internal state inspected. This skill is the opt-in
runtime-validation step. It is **not** a per-turn gate (e2e is heavy); you invoke
it when the task warrants it.

## When this applies

- User-facing behavior: a screen, a flow (e.g. sign in → see session), routing,
  data rendering, error states.
- Anything the user explicitly asks to "see working" in the app.
- NOT for pure `domain`/`application` changes — unit/contract tests cover those.

## The flow

1. **Mark the task** (opt-in signal so the Stop hook reminds you):
   ```bash
   mkdir -p .harness && touch .harness/require-e2e
   ```
2. **Write/extend the e2e** in `e2e/` to drive the feature as a user **and** assert
   on internal state through the bridge (`window.__app__.snapshot()` → queries,
   events, errors). Copy the shape of [e2e/example.spec.ts](../../../e2e/example.spec.ts).
   For a feature that emits domain events or errors, prefer asserting on
   `snapshot().events` / `snapshot().errors`, not just the DOM.
3. **Run it** (boots the dev server + a browser):
   ```bash
   pnpm harness e2e
   ```
   A **passing** run clears `.harness/require-e2e` — that is the "validated at
   runtime" signal.
4. **Deliver.** If you finish with the marker still present, the Stop hook prints a
   non-blocking reminder to run `pnpm harness e2e`.

## Reading runtime state ad-hoc

The same `window.__app__` is readable without Playwright — via the Claude Preview
MCP (`preview_eval`) or the Claude-in-Chrome extension — for interactive poking:

```js
window.__app__.snapshot(); // { useCases, queries, events, errors }
```

See [sensors.md](../../../docs/ai/sensors.md) (`e2e`) and the bridge at
`libs/ui/src/debug/debug-bridge.ts`.
