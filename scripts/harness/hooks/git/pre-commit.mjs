#!/usr/bin/env node
/**
 * git pre-commit — the agent-agnostic twin of Claude's pre-edit + post-edit
 * guards. Fires on `git commit` for ANY agent (Codex, Cursor) or human:
 *   1. rejects commits that touch protected files (same list as the Claude guard),
 *   2. lints the staged TS/TSX under libs/apps (boundaries + clean-code).
 * Reuses the harness — no duplicated logic. Exit non-zero blocks the commit.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const { isProtected } = await import(
  path.join(here, '..', '..', 'protected-files.mjs')
);

const git = (...a) =>
  (spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout || '').trim();

const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACM')
  .split('\n')
  .filter(Boolean);

// 1) Protected files.
const blocked = staged.filter(isProtected);
if (blocked.length) {
  process.stderr.write(
    `\n✖ Commit blocked: protected files changed:\n  ${blocked.join('\n  ')}\n` +
      `These define the architecture rules. Confirm the change with a human, then ` +
      `commit with --no-verify if intentional.\n`,
  );
  process.exit(1);
}

// 2) Lint staged source.
const code = staged.filter(
  (f) => /\.(ts|tsx)$/.test(f) && /^(libs|apps)\//.test(f),
);
const eslint = path.join(ROOT, 'node_modules', '.bin', 'eslint');
if (code.length && existsSync(eslint)) {
  const res = spawnSync(eslint, code, { cwd: ROOT, stdio: 'inherit' });
  if (res.status && res.status !== 0) {
    process.stderr.write('\n✖ Commit blocked: lint failed on staged files.\n');
    process.exit(1);
  }
}

process.exit(0);
