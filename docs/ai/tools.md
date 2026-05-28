# AI context — Evaluation tools

The tools you use to evaluate **quality, impact, performance and gaps** of a
change. Each maps to a script under `scripts/harness/` that prints **JSON** so you
can parse the result and decide next steps. Until a wrapper script exists, use the
raw command in the "today" column.

> Convention: run the wrapper, read the JSON, act on it. Don't eyeball raw logs
> when a structured tool exists.

| Goal | Tool (planned) | What it answers | Today (raw) |
| ---- | -------------- | --------------- | ----------- |
| **Quality** | `pnpm harness quality` | Does the slice pass lint + typecheck + test + boundary rules? | `nx affected -t lint typecheck test` |
| **Impact** | `pnpm harness impact` | What projects/platforms does my change blast-radius into? | `nx show projects --affected` · `nx affected --graph` |
| **Performance** | `pnpm harness perf` | Bundle size per app + benchmarks of pure domain/application functions | `nx build web` + `vitest bench` |
| **Gaps** | `pnpm harness gaps` | Ports without a contract test, use cases without a spec, screens without a test, coverage per layer, TODOs | coverage + scan (see below) |
| **Scaffold** | `pnpm harness scaffold <name>` | Generate a full vertical slice from the `Item` template | copy `example` per layer |
| **Explain** | `pnpm harness explain <layer>` | A layer's rules + canonical pattern | read `libs/<layer>/CLAUDE.md` |

## When to reach for which

- **Before declaring done** → `quality`. Non-negotiable gate.
- **Before a risky refactor / to scope review** → `impact`. Tells you who else is
  affected so you test the right things.
- **After touching domain/application hot paths or adding a screen** → `perf`.
- **When asked "what's missing?" or auditing a feature** → `gaps`. This is the
  one that's uniquely cheap here: because ports are types, a port with no adapter
  or no contract test is a *mechanically detectable* gap.

## Why JSON output

The model parses JSON reliably and can chain decisions (e.g. `gaps` returns a list
of untested ports → fix each → re-run `quality`). Logs are for humans.

## Status

The wrapper scripts under `scripts/harness/` are the next harness phase. This doc
is the catalog the model reads to know *which* tool fits *which* question; the raw
commands work today.
