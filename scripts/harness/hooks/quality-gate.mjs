#!/usr/bin/env node
/**
 * Stage 6 — Stop hook. A GUARDRAIL: blocks finishing on a red gate.
 *
 * This is just a *surface* over the `quality` sensor — it does not re-implement
 * the gate logic. It runs the sensor and, on failure, vetoes with exit 2 so the
 * model gets the failures and fixes them.
 *
 * Loop guard: when `stop_hook_active` is set, the model is already responding to
 * a previous block — do not block again, or the gate would loop forever.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  /* empty payload is fine */
}

if (payload.stop_hook_active) process.exit(0); // anti-loop

const cwd = payload.cwd || process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const sensor = path.resolve(here, '..', 'sensors', 'quality.mjs');
if (!existsSync(sensor)) process.exit(0); // sensor missing → don't block

// `--build` so the finishing gate matches CI (which runs build too).
const res = spawnSync(process.execPath, [sensor, `--root=${cwd}`, '--build'], {
  cwd,
  encoding: 'utf8',
});

let report = {};
try {
  report = JSON.parse(res.stdout || '{}');
} catch {
  /* if the sensor output is unparseable, fall through to status check */
}

if (res.status !== 0 || report.ok === false) {
  const detail =
    report.output || res.stderr || res.stdout || 'quality gate failed';
  process.stderr.write(
    `Quality gate failed (lint/typecheck/test). The work is not done until this ` +
      `is green. Fix the failures below and try again:\n\n${detail}`,
  );
  process.exit(2);
}

process.exit(0);
