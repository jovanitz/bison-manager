# The Harness — concepts & vocabulary (read first)

This file is the **conceptual anchor** for the AI development setup in this repo.
It fixes what each word means so we never mix three different things that all get
called "harness". When in doubt about a term, this file wins.

## Agent = Model + Harness

The model (Claude) has the intelligence but, on its own, has no loop, no memory,
no tools, no guardrails. The **harness** is everything around the model that turns
it into a reliable worker. We are doing **harness engineering**: building the
controls that make an AI agent effective _in this specific codebase_.

> **We do not build the harness runtime.** The execution loop, tool routing, and
> "when to stop" are provided by **Claude Code**. We engineer the _controls and
> context_ that plug into it. Don't reinvent the loop.

## Three meanings of "harness" — keep them separate

| Term                   | What it is                                                    | In this repo                                                  |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| **Test harness**       | Scaffolding that _runs tests_                                 | vitest / nx — already exists, not our project                 |
| **Evaluation harness** | Runs an agent and _scores it_ on a benchmark (e.g. SWE-bench) | **Not** what we build. We evaluate the _code_, not the agent. |
| **Agent harness**      | The controls + context around the model                       | **This is our project.**                                      |

If we ever want to measure "how well does the AI perform here", that is a separate
**evaluation harness** — do not fold it into this one.

## Our vocabulary (use these words)

- **Harness** — the whole environment around the model (Claude Code + everything
  in this repo's `docs/ai`, `.claude`, and `scripts/harness`).
- **Guides** — _feedforward_ controls: knowledge that steers the agent **before** it
  acts. Docs, rules, conventions. → `docs/ai/*`, the `CLAUDE.md` files, and the
  context-injecting hooks (`session-context`, `prompt-reminder`).
- **Sensors** — _feedback_ controls: checks that observe output and feed it back so
  the agent can self-correct. → `scripts/harness/sensors/*` (and the lint hook).
  - **Computational sensors** — deterministic, ms–seconds: lint, typecheck, test,
    `gaps`, `impact`, `perf`, `quality`.
  - **Inferential sensors** — AI/semantic, slower (none yet; e.g. a future
    semantic review would go here).
- **Guardrails** — sensors that **veto** an action, not just report. → the
  `pre-edit-guard` (PreToolUse) and `quality-gate` (Stop) hooks.
- **Generators** — productivity tools that _write code_ (classic "scaffolding").
  Not a control. → the planned `generate-feature` tool. (We avoid the word
  "scaffold" for this, because "scaffold" means something else — see below.)

### Reserved words we deliberately avoid

- **"Scaffold"** — in agent-harness literature this is the _behaviour-defining
  layer_ (system prompt, tool descriptions, context policy). To avoid collisions
  we don't use "scaffold" for code generation; we say **generator** /
  `generate-feature`.

## How the pieces map to the repo

```
Harness
├── Guides (feedforward)
│   ├── CLAUDE.md (root index) + libs/*/CLAUDE.md + apps/*/CLAUDE.md
│   ├── docs/ai/{architecture,constraints,workflow,security,structure}.md
│   ├── docs/ai/capabilities.json   (machine-readable rules; verified by `doctor`)
│   └── hooks: session-context, prompt-reminder   (inject guides at runtime)
├── Sensors (feedback)            → catalog: docs/ai/sensors.md
│   ├── computational: scripts/harness/sensors/{gaps,impact,perf,quality,structure,cycles,consumers,dead-code,coverage,e2e,audit,skill-scan,doctor}.mjs
│   │   (gaps respects scripts/harness/harness-ignore.json + // harness-ignore)
│   │   (impact = project-level, drives the gate; consumers = file-level review aid)
│   ├── clean-code: eslint.config.mjs (max-lines/complexity/… + eslint-plugin-sonarjs)
│   ├── cycles: madge (circular imports ESLint's layer rules can't see)
│   ├── dead-code: knip (knip.json) · coverage: vitest v8 (domain/application floor)
│   ├── runtime: e2e (Playwright + window.__app__ bridge) — opt-in, complex tasks
│   ├── security: audit (pnpm/OSV deps) · skill-scan (SkillSpector skills/MCP) · /security-review (app-code, inferential)
│   ├── exposed as CLI: pnpm harness <sensor>
│   ├── exposed as skills: find-gaps, evaluate-impact, evaluate-performance, …
│   └── hook: post-edit-check (lint the touched file)
├── Guardrails (vetoing sensors)
│   ├── hook: pre-edit-guard (PreToolUse) — blocks protected files + project.json tags
│   ├── hook: quality-gate (Stop) — blocks finishing (quality+structure+cycles+gaps; build = CI)
│   └── CI (.github/workflows/ci.yml) — Stop-hook set + coverage block; dead-code advisory
├── Generators (write code) → scripts/harness/generators/generate-feature.mjs (CRUD only)
└── Runtime  → Claude Code (loop, tool routing, stop) — not ours to build
```

## One engine, many surfaces

Each sensor's logic lives **once** in `scripts/harness/sensors/`. Hooks, the CLI,
and skills are just _surfaces_ that invoke it — they never re-implement it. (E.g.
the `quality-gate` guardrail calls the `quality` sensor.)

See [sensors.md](sensors.md) for the sensor catalog and how to run each.

## Portability (Claude + Codex)

The harness is **agent-agnostic by design** — the substance lives in the Node CLI
(`scripts/harness/`) and CI, not in any one assistant. Only the _delivery surface_
differs per agent:

| Layer       | Claude Code                     | Codex / others                               |
| ----------- | ------------------------------- | -------------------------------------------- |
| Context     | auto-loads `CLAUDE.md` + nested | reads `AGENTS.md` (same rules)               |
| Run checks  | hooks + skills fire             | run `pnpm harness <cmd>` (AGENTS.md says so) |
| Enforcement | local Stop hook **+ CI**        | **CI** (+ run the gate manually)             |

**Rule when changing the harness:** keep it working for **both**.

1. New logic goes in the **engine** (`scripts/harness/`), never embedded in a hook
   or skill — those stay thin surfaces.
2. **Every skill must map to a `pnpm harness <cmd>`** (no Claude-only capability).
3. Update **`AGENTS.md`** if you add a capability or a rule.

`pnpm harness doctor` enforces 1–3 mechanically (AGENTS.md present, each skill maps
to the CLI) and runs in CI, so portability can't silently rot.
