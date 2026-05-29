# AI context — Sensors (feedback controls)

**Sensors** are the harness's *feedback* controls: checks that observe output and
return a result the agent can act on. They are the counterpart to **Guides** (the
feedforward docs/rules). For the concepts and vocabulary, read
[harness.md](harness.md) first.

All sensors are **computational** (deterministic, ms–seconds) and print **JSON** to
stdout, so the model can parse the result and chain decisions. The logic lives once
in `scripts/harness/sensors/`; the CLI, skills, and hooks are just *surfaces* over
it — none re-implement it.

> Convention: run the sensor, read the JSON, act on it. Don't eyeball raw logs.

## Catalog

| Sensor | Answers | CLI | Skill |
| ------ | ------- | --- | ----- |
| **gaps** | Untested adapters/use-cases/screens/domain logic, TODOs | `pnpm harness gaps [--layer=<name>]` | `find-gaps` |
| **impact** | Blast radius: affected projects, platforms, risk | `pnpm harness impact [--base=<ref> --head=<ref>]` | `evaluate-impact` |
| **perf** | Bundle size (raw+gzip) + benchmarks of the pure core | `pnpm harness perf [--app=<name>] [--no-bundle\|--no-bench] [--skip-build]` | `evaluate-performance` |
| **quality** | Quality gate: lint + typecheck + test | `pnpm harness quality [--all]` | `evaluate-quality` |

## When to reach for which

- **Before declaring done** → `quality`. Non-negotiable. (Also enforced as a
  guardrail by the Stop hook — see [harness.md](harness.md).)
- **Before a risky refactor / to scope review** → `impact`. Test only what's
  affected.
- **After touching domain/application hot paths or adding a screen** → `perf`.
- **When asked "what's missing?" / auditing a feature** → `gaps`. Uniquely cheap
  here: because ports are types, an adapter with no contract test is a
  *mechanically detectable* gap.

## Status

- ✅ `gaps` — `scripts/harness/sensors/gaps.mjs`
- ✅ `impact` — `scripts/harness/sensors/impact.mjs`
- ✅ `perf` — `scripts/harness/sensors/perf.mjs` (benchmarks in `*.bench.ts`; seed:
  `libs/domain/src/example/item.bench.ts`)
- ✅ `quality` — `scripts/harness/sensors/quality.mjs` (also the Stop-hook guardrail)

## Not a sensor

- **`generate-feature`** (planned) is a **generator** — it *writes* a feature slice
  from the `Item` template. It produces code, it doesn't observe it, so it is not a
  control. (We avoid the word "scaffold" for it; see [harness.md](harness.md).)
- Per-layer rules/patterns are **Guides**, not a sensor — read the relevant
  `libs/<layer>/CLAUDE.md` and [architecture.md](architecture.md).
