#!/usr/bin/env node
/**
 * Stage 6 — Stop hook.
 * Runs the quality gate (lint + typecheck + test) on affected projects before
 * the agent is allowed to finish. Strict: a red gate vetoes with exit 2 and
 * returns the failure so the model fixes it.
 *
 * Loop guard: when `stop_hook_active` is set, the model is already responding to
 * a previous block — do not block again, or the gate would loop forever.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  /* fall through with empty payload */
}

if (payload.stop_hook_active) process.exit(0); // anti-loop

const cwd = payload.cwd || process.cwd();
const nx = path.join(cwd, 'node_modules', '.bin', 'nx');
if (!existsSync(nx)) process.exit(0); // nx not installed → don't block

const targets = ['lint', 'typecheck', 'test'];

// Prefer `affected` (fast, needs git); fall back to `run-many` if affected
// can't resolve a base (e.g. shallow/initial repo state).
const tryRun = (mode) =>
  spawnSync(nx, [mode, '-t', ...targets], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });

let res = tryRun('affected');
const cannotResolveBase =
  res.status &&
  /affected|base|NX_BASE|Could not find|SHA/i.test(`${res.stdout}${res.stderr}`) &&
  /base/i.test(`${res.stdout}${res.stderr}`);
if (cannotResolveBase) {
  res = tryRun('run-many');
}

if (res.status && res.status !== 0) {
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim().slice(0, 6000);
  process.stderr.write(
    `Quality gate failed (lint/typecheck/test). The work is not done until this ` +
      `is green. Fix the failures below and try again:\n\n${out}`,
  );
  process.exit(2);
}

process.exit(0);
