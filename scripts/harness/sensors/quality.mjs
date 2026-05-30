#!/usr/bin/env node
/**
 * Harness sensor — `quality`.
 *
 * Runs the quality gate: lint + typecheck + test on affected projects (with a
 * run-many fallback when no git base can be resolved). This is the single source
 * of the gate logic — the `quality-gate` guardrail (Stop hook) calls into it
 * rather than duplicating it.
 *
 * Prints JSON to stdout. Exit 0 when green, 1 when red.
 *
 * Usage: node scripts/harness/sensors/quality.mjs [--all] [--base=<ref>] [--head=<ref>]
 *        [--targets=lint,typecheck,test] [--root=<dir>]
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const targets = (getArg('targets') || 'lint,typecheck,test')
  .split(',')
  .filter(Boolean);
// `--build` adds the build target so the gate matches CI (ci.yml runs build too).
if (has('build') && !targets.includes('build')) targets.push('build');
const base = getArg('base');
const head = getArg('head');

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const nx = path.join(ROOT, 'node_modules', '.bin', 'nx');
if (!existsSync(nx)) {
  emit({ tool: 'quality', ok: false, error: 'nx not installed' }, 1);
}

/** Run a given nx mode (affected | run-many) for the targets, capturing output. */
const run = (mode) => {
  const extra = [];
  if (mode === 'affected') {
    if (base) extra.push(`--base=${base}`);
    if (head) extra.push(`--head=${head}`);
  }
  return spawnSync(nx, [mode, '-t', ...targets, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });
};

const started = Date.now();
let mode = has('all') ? 'run-many' : 'affected';
let res = run(mode);

// Fall back to run-many if `affected` couldn't resolve a base.
if (mode === 'affected' && res.status) {
  const blob = `${res.stdout}${res.stderr}`;
  if (
    /base/i.test(blob) &&
    /(affected|NX_BASE|Could not find|SHA)/i.test(blob)
  ) {
    mode = 'run-many';
    res = run(mode);
  }
}

const ok = res.status === 0;
const output = ok
  ? ''
  : `${res.stdout || ''}${res.stderr || ''}`.trim().slice(0, 6000);

emit(
  {
    tool: 'quality',
    generatedAt: new Date().toISOString(),
    ok,
    mode,
    targets,
    durationMs: Date.now() - started,
    output,
  },
  ok ? 0 : 1,
);
