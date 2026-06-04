# Harness — overview & lifecycle

The harness is everything around the AI that keeps work correct, clean and safe.
Three kinds of parts: **Guides** (knowledge it reads), **Sensors** (checks that
report), **Guardrails** (checks that block). This page shows **what each part does
and when it fires**. Concepts: [harness.md](harness.md) · Tools: [sensors.md](sensors.md).

## When each part activates (by phase)

| Phase                            | What fires                                                                       | Type             | Blocks?                                |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------------- | -------------------------------------- |
| **Session start**                | loads `CLAUDE.md` + `session-context` hook injects orientation                   | Guide            | no                                     |
| **You send a prompt**            | `prompt-reminder` hook injects the rules                                         | Guide            | no                                     |
| **Planning / coding**            | reads `docs/ai/*` + the layer's `CLAUDE.md` as needed                            | Guide            | no                                     |
| **Before editing a file**        | `pre-edit-guard` hook                                                            | Guardrail        | **yes** — protected files / layer tags |
| **After editing a file**         | `post-edit-check` hook → prettier + eslint (+SonarJS)                            | Guardrail        | **yes** — on lint/boundary error       |
| **While building (on demand)**   | `impact`, `consumers`, `perf`, `gaps`, `dead-code`, `doctor`                     | Sensor           | no                                     |
| **Complex / user-facing task**   | `e2e` (browser + `window.__app__`), via verify-runtime skill                     | Sensor           | nudge only                             |
| **Before delivering (Stop)**     | `quality`(+build) · `structure` · `cycles` · `gaps`                              | Guardrail        | **yes**                                |
| **git commit** (any agent/human) | `.githooks/pre-commit` → protected-files guard + lint staged                     | Guardrail        | **yes** (`--no-verify` to bypass)      |
| **git push** (any agent/human)   | `.githooks/pre-push` → `pnpm gate`                                               | Guardrail        | **yes** (`--no-verify` to bypass)      |
| **In CI (merge)**                | Stop-hook set + `coverage` + `doctor`; `dead-code`/`audit`/`skill-scan` advisory | Guardrail/Sensor | **yes** (advisory ones don't)          |

> The git-commit/push rows are **agent-independent** — they fire for Claude,
> Codex, Cursor and humans alike (wired by `package.json`'s `prepare` →
> `core.hooksPath .githooks`). Same scripts, just triggered by git.

## What each tool does (one line)

**Guides (read for knowledge)**

- `CLAUDE.md` — the index; points to everything else.
- `architecture.md` — which layer a change goes in and what it may import.
- `constraints.md` — the hard rules (no classes, Result-not-throw, size limits…).
- `methodology.md` — how we model (DDD) and work (TDD).
- `structure.md` — small files, ≤8 files/folder, screaming folders.
- `security.md` — rules for sensitive features (auth, tokens, permissions).
- `workflow.md` — the step-by-step loop to build a feature.
- `capabilities.json` — the layer rules in machine-readable form.

**Sensors (run a check, return JSON)** — `pnpm harness <name>` · format: _what it answers_ — **uses**

- `quality` — lint + typecheck + test (+build) pass? — **Nx affected** running ESLint + `tsc` + Vitest + Vite build
- `structure` — files small, folders not overcrowded? — **custom Node scan** (+ ESLint `max-lines`/complexity & `eslint-plugin-sonarjs`)
- `cycles` — any circular imports? — **madge**
- `gaps` — any use case/adapter without a test? (TDD gate) — **custom Node scan** (imports + naming conventions)
- `coverage` — core coverage floor (domain ≥90, application ≥75)? — **Vitest + @vitest/coverage-v8**
- `impact` — which projects/platforms does this change reach? — **Nx affected** (project graph) + `project.json` tags
- `consumers` — exactly which files import what I changed? — **custom Node** reverse-import graph (resolves `@acme/*` via tsconfig paths)
- `perf` — bundle size + speed of the pure core — **Vite build** (gzip sizes) + **Vitest bench**
- `dead-code` — unused files/exports? — **knip**
- `e2e` — does the running app behave + what's its state? — **Playwright + Chromium** driving the app + the `window.__app__` **bridge**
- `audit` — dependency CVEs? — **`pnpm audit`** (OSV advisories)
- `skill-scan` — risky skills/MCP? — **NVIDIA SkillSpector** (skips if not installed)
- `doctor` — is the harness itself healthy? — **custom Node** (checks files/wiring + smoke-runs sensors)

**Guardrails (hooks that can block)** — automatic, in `.claude/settings.json`

- `pre-edit-guard` — blocks editing protected config / layer-tag files. — **Node** (path check)
- `post-edit-check` — formats + lints the file you just touched. — **Prettier + ESLint**
- `quality-gate` (Stop) — won't let work finish unless quality + structure + cycles
  - gaps are green; also nudges if a runtime task wasn't `e2e`-verified. — **calls the sensors**

**Generators (write code)**

- `generate-feature <name>` — scaffolds a new CRUD feature from the example. — **custom Node** copy + rename

> Underlying tech, in one breath: **Nx** (project graph/affected) · **ESLint +
> eslint-plugin-sonarjs** (rules) · **Vitest + v8 coverage** (tests) · **Vite**
> (build/bundle) · **madge** (cycles) · **knip** (dead code) · **Playwright +
> Chromium** (e2e) · **pnpm audit** (CVEs) · **SkillSpector** (skill security).
> The rest is small custom Node scripts.

## The one rule to remember

- **Guides** = it reads them. **Sensors** = you/it run them when useful.
  **Guardrails** = they run by themselves and can stop bad work.
