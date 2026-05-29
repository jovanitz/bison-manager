# The Harness — concepts & vocabulary (read first)

This file is the **conceptual anchor** for the AI development setup in this repo.
It fixes what each word means so we never mix three different things that all get
called "harness". When in doubt about a term, this file wins.

## Agent = Model + Harness

The model (Claude) has the intelligence but, on its own, has no loop, no memory,
no tools, no guardrails. The **harness** is everything around the model that turns
it into a reliable worker. We are doing **harness engineering**: building the
controls that make an AI agent effective *in this specific codebase*.

> **We do not build the harness runtime.** The execution loop, tool routing, and
> "when to stop" are provided by **Claude Code**. We engineer the *controls and
> context* that plug into it. Don't reinvent the loop.

## Three meanings of "harness" — keep them separate

| Term | What it is | In this repo |
| ---- | ---------- | ------------ |
| **Test harness** | Scaffolding that *runs tests* | vitest / nx — already exists, not our project |
| **Evaluation harness** | Runs an agent and *scores it* on a benchmark (e.g. SWE-bench) | **Not** what we build. We evaluate the *code*, not the agent. |
| **Agent harness** | The controls + context around the model | **This is our project.** |

If we ever want to measure "how well does the AI perform here", that is a separate
**evaluation harness** — do not fold it into this one.

## Our vocabulary (use these words)

- **Harness** — the whole environment around the model (Claude Code + everything
  in this repo's `docs/ai`, `.claude`, and `scripts/harness`).
- **Guides** — *feedforward* controls: knowledge that steers the agent **before** it
  acts. Docs, rules, conventions. → `docs/ai/*`, the `CLAUDE.md` files, and the
  context-injecting hooks (`session-context`, `prompt-reminder`).
- **Sensors** — *feedback* controls: checks that observe output and feed it back so
  the agent can self-correct. → `scripts/harness/sensors/*` (and the lint hook).
  - **Computational sensors** — deterministic, ms–seconds: lint, typecheck, test,
    `gaps`, `impact`, `perf`, `quality`.
  - **Inferential sensors** — AI/semantic, slower (none yet; e.g. a future
    semantic review would go here).
- **Guardrails** — sensors that **veto** an action, not just report. → the
  `pre-edit-guard` (PreToolUse) and `quality-gate` (Stop) hooks.
- **Generators** — productivity tools that *write code* (classic "scaffolding").
  Not a control. → the planned `generate-feature` tool. (We avoid the word
  "scaffold" for this, because "scaffold" means something else — see below.)

### Reserved words we deliberately avoid

- **"Scaffold"** — in agent-harness literature this is the *behaviour-defining
  layer* (system prompt, tool descriptions, context policy). To avoid collisions
  we don't use "scaffold" for code generation; we say **generator** /
  `generate-feature`.

## How the pieces map to the repo

```
Harness
├── Guides (feedforward)
│   ├── CLAUDE.md (root index) + libs/*/CLAUDE.md + apps/*/CLAUDE.md
│   ├── docs/ai/{architecture,constraints,workflow}.md
│   ├── docs/ai/capabilities.json   (machine-readable rules)
│   └── hooks: session-context, prompt-reminder   (inject guides at runtime)
├── Sensors (feedback)            → catalog: docs/ai/sensors.md
│   ├── scripts/harness/sensors/{gaps,impact,perf,quality}.mjs
│   ├── exposed as CLI: pnpm harness <sensor>
│   ├── exposed as skills: find-gaps, evaluate-impact, evaluate-performance, …
│   └── hook: post-edit-check (lint the touched file)
├── Guardrails (vetoing sensors)
│   ├── hook: pre-edit-guard (PreToolUse) — blocks protected files
│   └── hook: quality-gate (Stop) — blocks finishing on a red gate
└── Runtime  → Claude Code (loop, tool routing, stop) — not ours to build
```

## One engine, many surfaces

Each sensor's logic lives **once** in `scripts/harness/sensors/`. Hooks, the CLI,
and skills are just *surfaces* that invoke it — they never re-implement it. (E.g.
the `quality-gate` guardrail calls the `quality` sensor.)

See [sensors.md](sensors.md) for the sensor catalog and how to run each.
