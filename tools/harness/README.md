# @harness/core — a portable AI-development harness

A project-agnostic engine for the dev-tooling that keeps an AI-assisted codebase
correct, clean and safe: a **grouped tool dispatcher**, reusable **hook runners**
(protected-files guard, session-context, post-edit format+lint) and generic
**sensors** (e.g. `purity`). It knows nothing about a specific repo — a consuming
project supplies its **config**, its **manifest** (tool list) and its **plugins**
(domain-coupled sensors). Same engine, any project.

## The split (ESLint-style: engine + config + plugins)

| Layer        | Lives in                                  | What it is                                                                                                      |
| ------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **core**     | `@harness/core` (this package)            | the dispatch engine, hook runners, generic sensors — no project knowledge                                       |
| **config**   | `harness.config.mjs` (consumer root)      | this repo's values: protected files, structure limits, source roots, gaps conventions, pure layers, orientation |
| **manifest** | `scripts/harness/manifest.mjs` (consumer) | the tool list grouped by purpose (check / analyze / secure / inspect / meta)                                    |
| **plugins**  | `scripts/harness/sensors/*` (consumer)    | domain-coupled sensors (e.g. `rules`, `formal`) the manifest points to                                          |

The host repo's `scripts/harness/*` are **thin shims**: they load `harness.config`,
call the core, and emit JSON / set the exit code. `.claude` hooks + git hooks
point at those shims (or directly at the core).

## Groups

- **check** — fast correctness gates ("is it green to finish?"); the Stop-hook set.
- **analyze** — understand a change (blast radius, coverage, perf); non-blocking.
- **secure** — supply chain + agent-surface security.
- **inspect** — live app (e2e; a Runtime Inspector MCP folds in here later).
- **meta** — self-check (`doctor`) + generators.

Each group is also the (future) MCP namespace, so new tools grow `group.tool`
rather than flattening a top-level list.

## Adopting it in a new project

1. Add `@harness/core` as a dependency (workspace package or published).
2. Write `harness.config.mjs` at the repo root — see the schema below.
3. Provide `scripts/harness/manifest.mjs` (your tool list) + the shim CLI:
   ```js
   import { runHarnessCli } from '@harness/core';
   import { GROUPS, TOOLS } from './manifest.mjs';
   process.exit(
     runHarnessCli({
       scriptsDir: import.meta.dirname,
       groups: GROUPS,
       tools: TOOLS,
       argv: process.argv.slice(2),
     }),
   );
   ```
4. Register project **plugins** (domain sensors) as manifest entries pointing to
   your `sensors/*.mjs`.
5. Wire hooks: `.claude/settings.json` + `.githooks/*` to your shims (which call
   the core runners with your config).
6. `harness doctor` to self-check the wiring.

## `harness.config.mjs` schema

```js
export default {
  protectedFiles: ['eslint.config.mjs' /* … */], // pre-edit + git guard
  structure: { maxFilesPerDir: 8, maxFileLoc: 250 }, // structure sensor
  sourceRoots: ['libs/', 'apps/'], // post-edit lints these
  conventions: { adapterDir, useCaseFile, screenFile, domainLayer }, // gaps (RegExp sources)
  purity: {
    layers: ['libs/domain/src', 'libs/application/src'],
    exclude: [
      /* globs */
    ],
  },
  capabilitiesCheck: { capabilities, eslint } | null, // doctor; null to skip
  orientation: ['line 1', 'line 2'], // SessionStart context
};
```

## What ships here vs stays in the repo

- **Ships (portable):** the dispatch engine, `protected-files` / `session-context`
  / `post-edit` runners, the `purity` sensor engine.
- **Stays in the consumer (project-bound):** the manifest (tool list), the domain
  plugins (`rules`, `formal`), the `capabilities↔eslint` doctor check, and the
  domain docs (architecture, auth, capabilities).

## Status

Early extraction. The dispatch engine + the listed hook runners + `purity` are in
the package; the remaining sensors are still thin shims in the host repo (they
shell out to nx/madge/knip/vitest) and migrate incrementally. Not yet published
to npm — consumed in-repo by path today.
