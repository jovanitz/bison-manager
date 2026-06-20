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

The harness is **one CLI**, grouped by purpose; every capability is reachable
here, no Claude needed. The blocking gate is one command (it derives from
`scripts/harness/manifest.mjs`, so it can never drift from a hand-kept list):

```bash
pnpm harness check        # the gate: quality + structure + cycles + gaps + rules + formal + purity
pnpm harness              # print the grouped tree (check/analyze/secure/inspect/meta)
pnpm harness <tool>       # one tool, e.g. `gaps --layer=domain`, `purity`, `impact`
pnpm harness <group>      # a whole group, e.g. `analyze`, `secure`
```

## If you are NOT Claude Code (e.g. Codex)

Claude Code auto-runs guardrails (pre-edit / post-edit / Stop gate) and triggers
skills. **Those do not fire for you.** So:

- **Before declaring work done, run the gate yourself:** `pnpm harness check`
  (for a complex/user-facing task, also `pnpm harness e2e`).
- **Don't edit protected files** without confirming: `eslint.config.mjs`,
  `docs/ai/capabilities.json`, `tsconfig.base.json`, lockfiles, `.claude/settings.json`,
  and an EXISTING `**/project.json` (a new app/lib's project.json is allowed).
- CI runs all of this regardless of the agent — a green CI means the rules held.

## Changing the harness?

Keep it working for **both** Claude and Codex: the **engine** (`scripts/harness/`)
is the single source of truth; hooks and skills are thin surfaces over it. **Every
skill must map to a `pnpm harness <cmd>`** so no capability is Claude-only. Run
`pnpm harness doctor` — it validates this. See
[docs/ai/harness.md](docs/ai/harness.md) (Portability).
