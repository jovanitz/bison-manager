#!/usr/bin/env node
/**
 * Harness sensor — `runtime-advice`.
 *
 * Answers ONE question cheaply: does this change touch a "faked seam" — something
 * the simulated test tier (vitest: jsdom/happy-dom/in-memory adapters) replaces
 * with a fake, so a defect there is invisible until the real app runs? If yes,
 * runtime validation (e2e, or the cheaper level noted) earns its cost; if no, it
 * does NOT — the simulated tier already covers the change. This is what stops us
 * paying for e2e by default. The seams live in `harness.config.mjs` (runtimeSeams)
 * and the rationale in docs/ai/methodology.md ("When does e2e earn its cost?").
 *
 * Advisory: always `ok: true`, exit 0 — it reports, it never fails a gate. The
 * Stop hook surfaces it as a non-blocking nudge; Codex/CI/humans can run it too.
 *
 * Usage: node scripts/harness/sensors/runtime-advice.mjs [--base=<ref>] [--head=<ref>] [--root=<dir>]
 *   No flags  → the current working-tree changes (vs HEAD) + untracked files.
 *   --base/--head → a commit range (e.g. a PR), via `git diff --name-only base head`.
 */
import { writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import harnessConfig from '../../../harness.config.mjs';

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const base = getArg('base');
const head = getArg('head');

const git = (gitArgs) =>
  spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).stdout || '';

// Changed files: a commit range when given, else the working tree vs HEAD plus
// untracked files (mirrors what the Stop hook considers "this task's diff").
const changed = (
  base
    ? [git(['diff', '--name-only', base, head || 'HEAD'])]
    : [
        git(['diff', '--name-only', 'HEAD']),
        git(['ls-files', '--others', '--exclude-standard']),
      ]
)
  .join('\n')
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

const seams = (harnessConfig.runtimeSeams ?? []).map((s) => ({
  ...s,
  re: new RegExp(s.match),
}));

// Each changed file × each seam → a hit. Dedupe by file (a file matches one seam).
const hits = [];
for (const file of changed) {
  const seam = seams.find((s) => s.re.test(file));
  if (seam) hits.push({ file, fakes: seam.fakes, suggest: seam.suggest });
}

const needsRuntime = hits.length > 0;
const note = needsRuntime
  ? 'This change touches a faked seam — the simulated tier cannot see a defect here. Validate at runtime (or push it down to the cheaper level noted).'
  : 'No faked seam touched — the simulated tier (unit + integration) already covers this change. No runtime validation needed.';

// Sync write: process.exit() can truncate a pipe-bound report mid-flush.
writeSync(
  1,
  JSON.stringify(
    {
      tool: 'runtime-advice',
      generatedAt: new Date().toISOString(),
      ok: true,
      needsRuntime,
      seams: hits,
      note,
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = 0;
