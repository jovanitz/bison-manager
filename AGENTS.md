# AGENTS.md — cross-agent guide (Codex, Cursor, …)

This project is AI-first, but its rules and tools are **agent-agnostic**: they live
in the harness (a Node CLI + CI), not in any one assistant. Claude Code gets them
auto-wired (via `CLAUDE.md` + hooks + skills); **other agents read this file**.

## Source of truth (any agent can read these)

- [docs/ai/harness-overview.md](docs/ai/harness-overview.md) — what each part does and when it fires
- [docs/ai/architecture.md](docs/ai/architecture.md) + [capabilities.json](docs/ai/capabilities.json) — layer/import rules
- [docs/ai/constraints.md](docs/ai/constraints.md) — the hard rules
- [docs/ai/workflow.md](docs/ai/workflow.md) + [methodology.md](docs/ai/methodology.md) — how to build (DDD/TDD)

`CLAUDE.md` is the same router with the same rules — nothing in it is Claude-only
knowledge.

## Non-negotiables (full list in constraints.md)

- No classes/decorators. Return `Result`, never `throw`.
- `domain` & `application` import no framework, browser, DB, HTTP, auth or native.
- Ports are `type`s; adapters are factory functions; DI is wired only in
  `apps/*/composition-root.ts`.
- Small files (≤200 lines), ≤8 files per folder, screaming feature folders.

## Your gate — run it (CI enforces the same)

The harness is **one CLI**; every capability is reachable here, no Claude needed:

```bash
pnpm harness quality      # lint + typecheck + test  (add --build to match CI)
pnpm harness structure    # small files / folders
pnpm harness cycles       # circular imports
pnpm harness gaps         # untested use case/adapter (TDD gate)
# also: coverage · impact · consumers · perf · dead-code · audit · e2e · doctor
```

## If you are NOT Claude Code (e.g. Codex)

Claude Code auto-runs guardrails (pre-edit / post-edit / Stop gate) and triggers
skills. **Those do not fire for you.** So:

- **Before declaring work done, run the gate yourself:**
  `pnpm harness quality && pnpm harness structure && pnpm harness cycles && pnpm harness gaps`
  (for a complex/user-facing task, also `pnpm harness e2e`).
- **Don't edit protected files** without confirming: `eslint.config.mjs`,
  `**/project.json`, `tsconfig.base.json`, `docs/ai/capabilities.json`, lockfiles.
- CI runs all of this regardless of the agent — a green CI means the rules held.

## Changing the harness?

Keep it working for **both** Claude and Codex: the **engine** (`scripts/harness/`)
is the single source of truth; hooks and skills are thin surfaces over it. **Every
skill must map to a `pnpm harness <cmd>`** so no capability is Claude-only. Run
`pnpm harness doctor` — it validates this. See
[docs/ai/harness.md](docs/ai/harness.md) (Portability).
