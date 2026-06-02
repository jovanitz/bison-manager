# AI context — Sensors (feedback controls)

**Sensors** are the harness's _feedback_ controls: checks that observe output and
return a result the agent can act on. They are the counterpart to **Guides** (the
feedforward docs/rules). For the concepts and vocabulary, read
[harness.md](harness.md) first.

All sensors are **computational** (deterministic, ms–seconds) and print **JSON** to
stdout, so the model can parse the result and chain decisions. The logic lives once
in `scripts/harness/sensors/`; the CLI, skills, and hooks are just _surfaces_ over
it — none re-implement it.

> Convention: run the sensor, read the JSON, act on it. Don't eyeball raw logs.

## Catalog

| Sensor         | Answers                                                                                 | CLI                                                                         | Skill                  |
| -------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- |
| **gaps**       | Untested adapters/use-cases/screens/domain logic, TODOs                                 | `pnpm harness gaps [--layer=<name>]`                                        | `find-gaps`            |
| **impact**     | Blast radius: affected projects, platforms, risk                                        | `pnpm harness impact [--base=<ref> --head=<ref>]`                           | `evaluate-impact`      |
| **perf**       | Bundle size (raw+gzip) + benchmarks of the pure core                                    | `pnpm harness perf [--app=<name>] [--no-bundle\|--no-bench] [--skip-build]` | `evaluate-performance` |
| **quality**    | Quality gate: lint + typecheck + test (`--build` to match CI)                           | `pnpm harness quality [--build] [--all]`                                    | `evaluate-quality`     |
| **structure**  | File/folder organization: files-per-folder (≤8), oversized files; screaming arch        | `pnpm harness structure`                                                    | —                      |
| **cycles**     | Circular import dependencies (file level, via madge)                                    | `pnpm harness cycles`                                                       | —                      |
| **consumers**  | File-level blast radius: who imports the changed/named files (direct + transitive)      | `pnpm harness consumers [<file>…]`                                          | —                      |
| **dead-code**  | Unused files / exports / types (knip)                                                   | `pnpm harness dead-code`                                                    | —                      |
| **coverage**   | Per-layer line-coverage floor on the pure core (domain ≥90, application ≥75)            | `pnpm harness coverage [--min-domain= --min-application=]`                  | —                      |
| **e2e**        | Browser-level verification (Playwright) + runtime bridge introspection                  | `pnpm harness e2e`                                                          | `verify-runtime`       |
| **audit**      | Dependency CVE scan (`pnpm audit` / OSV) — software supply chain                        | `pnpm harness audit [--level=high]`                                         | —                      |
| **skill-scan** | Agent-surface security scan of skills/MCP (NVIDIA SkillSpector; skips if not installed) | `pnpm harness skill-scan`                                                   | —                      |
| **doctor**     | Self-check the harness (hooks wired, scripts present, capabilities↔eslint in sync, git) | `pnpm harness doctor`                                                       | —                      |

## When to reach for which

- **Before declaring done** → `quality`. Non-negotiable. (Also enforced as a
  guardrail by the Stop hook, which runs it with `--build` to match CI — see
  [harness.md](harness.md).)
- **Before a risky refactor / to scope which projects to test** → `impact`
  (project level — this is what the gate runs).
- **Before changing a shared symbol's signature / to focus review** → `consumers`
  (file level — exactly which files import what you changed, direct + transitive).
  Complements `impact`; it does not drive the gate.
- **After touching domain/application hot paths or adding a screen** → `perf`.
- **What's missing / TDD gate** → `gaps`. Blocks the Stop hook & CI on a
  high-severity gap (untested use case or adapter) — this is the TDD enforcement.
  Uniquely cheap here: because ports are types, an adapter with no contract test
  is a _mechanically detectable_ gap. Silence intentional ones via
  `scripts/harness/harness-ignore.json` or an inline `// harness-ignore`.
- **To keep files small / folders organized** → `structure` (also part of the
  Stop guardrail). See [structure.md](structure.md).
- **Suspect a circular import** → `cycles` (also part of the Stop guardrail).
- **Auditing unused/orphaned code** → `dead-code` (knip; finds what nothing imports).
- **Checking the core stays well-tested** → `coverage` (domain/application floor;
  enforced in CI — slower, so not in the local Stop hook).
- **After touching the harness / before starting real work** → `doctor`.

> **Inferential sensor:** for logic-level review (e.g. auth flaws) the
> computational sensors above won't help — use the built-in `/security-review`
> skill. See [security.md](security.md).

## Status

- ✅ `gaps` — `scripts/harness/sensors/gaps.mjs`
- ✅ `impact` — `scripts/harness/sensors/impact.mjs`
- ✅ `perf` — `scripts/harness/sensors/perf.mjs` (benchmarks in `*.bench.ts`; seed:
  `libs/domain/src/example/item.bench.ts`)
- ✅ `quality` — `scripts/harness/sensors/quality.mjs` (also the Stop-hook guardrail)
- ✅ `structure` — `scripts/harness/sensors/structure.mjs` (also the Stop-hook guardrail)
- ✅ `cycles` — `scripts/harness/sensors/cycles.mjs` (madge; also the Stop-hook guardrail)
- ✅ `consumers` — `scripts/harness/sensors/consumers.mjs` (file-level blast radius)
- ✅ `dead-code` — `scripts/harness/sensors/dead-code.mjs` (knip; advisory in CI)
- ✅ `coverage` — `scripts/harness/sensors/coverage.mjs` (CI gate; not in Stop hook)
- ✅ `e2e` — `scripts/harness/sensors/e2e.mjs` (Playwright; runtime validation)
- ✅ `audit` — `scripts/harness/sensors/audit.mjs` (pnpm audit; advisory in CI)
- ✅ `skill-scan` — `scripts/harness/sensors/skill-scan.mjs` (SkillSpector; skips if absent)
- ✅ `doctor` — `scripts/harness/sensors/doctor.mjs` (smoke-tests the fast sensors)

## Where each runs

- **Local Stop hook (guardrail, blocks "done")**: `quality` (+build), `structure`,
  `cycles`, `gaps` (TDD gate — no untested use case/adapter).
- **CI (blocks merge)**: the Stop-hook set + `coverage`; `dead-code`, `audit`,
  `skill-scan` run **advisory** (visible, non-blocking — security baseline to
  promote to blocking once the tree is clean).
- **On-demand only**: `impact`, `consumers`, `perf`, `doctor`.
- **Security**: `audit` = dependency CVEs (software supply chain); `skill-scan` =
  agent surface (skills/MCP). Complement `/security-review` (app-code semantics).
  See [security.md](security.md).
- **Runtime validation (opt-in, complex/user-facing tasks)**: `e2e`. Mark the task
  (`.harness/require-e2e`), build/run it; a pass clears the mark. The Stop hook
  **nudges (non-blocking)** if the mark is still set. See the **verify-runtime**
  skill and [workflow.md](workflow.md) step 8.

## Not a sensor

- **`generate-feature`** is a **generator** — it _writes_ a feature slice from the
  `Item` template. It produces code, it doesn't observe it, so it is not a control.
  (We avoid the word "scaffold" for it; see [harness.md](harness.md).)
- Per-layer rules/patterns are **Guides**, not a sensor — read the relevant
  `libs/<layer>/CLAUDE.md` and [architecture.md](architecture.md).
