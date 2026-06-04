#!/usr/bin/env node
/**
 * Stage 6 — Stop hook. A GUARDRAIL: blocks finishing when the work isn't clean.
 *
 * It is a *surface* over sensors — it does not re-implement their logic. It runs
 * the `quality` sensor (lint+typecheck+test+build, matching CI) and the
 * `structure` sensor (folder/file organization); a failure in either vetoes
 * with exit 2 so the model gets the failures and fixes them.
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
const sensorsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'sensors',
);

const runSensor = (file, extra = []) => {
  const sensor = path.join(sensorsDir, file);
  if (!existsSync(sensor)) return { ok: true };
  const res = spawnSync(process.execPath, [sensor, `--root=${cwd}`, ...extra], {
    cwd,
    encoding: 'utf8',
  });
  let report = {};
  try {
    report = JSON.parse(res.stdout || '{}');
  } catch {
    /* unparseable → rely on status */
  }
  return { ok: res.status === 0 && report.ok !== false, report, res };
};

const veto = (message) => {
  process.stderr.write(message);
  process.exit(2);
};

// 1) Quality gate (matches CI: lint + typecheck + test + build).
const q = runSensor('quality.mjs', ['--build']);
if (!q.ok) {
  const detail = q.report?.output || q.res?.stderr || q.res?.stdout || 'failed';
  veto(
    `Quality gate failed (lint/typecheck/test/build). The work is not done until ` +
      `it is green. Fix the failures below and try again:\n\n${detail}`,
  );
}

// 2) Structure (small files, no overcrowded folders).
const s = runSensor('structure.mjs');
if (!s.ok) {
  const lines = (s.report?.violations || [])
    .map((v) => `- [${v.severity}] ${v.type}: ${v.path} — ${v.detail}`)
    .join('\n');
  veto(
    `Structure check failed (keep files small and folders organized). Fix before ` +
      `finishing:\n\n${lines || s.res?.stderr || 'structure violations'}`,
  );
}

// 3) Circular dependencies.
const c = runSensor('cycles.mjs');
if (!c.ok) {
  const lines = (c.report?.cycles || []).map((cy) => `- ${cy}`).join('\n');
  veto(
    `Circular dependencies detected. Break the cycle before finishing:\n\n` +
      `${lines || c.res?.stderr || 'cycles found'}`,
  );
}

// 4) TDD enforcement: no untested use case / adapter (high-severity gaps).
const g = runSensor('gaps.mjs');
if (!g.ok) {
  const lines = (g.report?.gaps || [])
    .filter((x) => x.severity === 'high')
    .map((x) => `- ${x.type}: ${x.file} — ${x.suggestion}`)
    .join('\n');
  veto(
    `Untested core code (TDD gate). Add the missing test before finishing:\n\n` +
      `${lines || g.res?.stderr || 'high-severity gaps'}`,
  );
}

// 5) If THIS change touched the harness itself, validate it stays portable across
// Claude / Codex / git / CI (doctor). Only fires when harness files changed, so
// normal app work doesn't pay for it.
const changed = [
  spawnSync('git', ['diff', '--name-only', 'HEAD'], { cwd, encoding: 'utf8' })
    .stdout || '',
  spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd,
    encoding: 'utf8',
  }).stdout || '',
]
  .join('\n')
  .split('\n')
  .filter(Boolean);
const HARNESS_RE =
  /^(scripts\/harness\/|\.claude\/|\.githooks\/|AGENTS\.md|CLAUDE\.md|package\.json|eslint\.config\.mjs|docs\/ai\/capabilities\.json)/;
if (changed.some((f) => HARNESS_RE.test(f))) {
  const d = runSensor('doctor.mjs');
  if (!d.ok) {
    const fails = (d.report?.checks || [])
      .filter((c) => !c.ok)
      .map((c) => `- ${c.name}${c.detail ? `: ${c.detail}` : ''}`)
      .join('\n');
    veto(
      `Harness changed but \`doctor\` failed — keep it portable across ` +
        `Claude/Codex/git/CI before finishing:\n\n${fails || d.res?.stderr || 'doctor failed'}`,
    );
  }
}

// 6) Runtime-validation reminder (opt-in, NON-BLOCKING). When a task is marked as
// needing runtime validation (.harness/require-e2e) and no passing `e2e` run has
// cleared it, nudge — but allow delivery (the user chose warn, not block).
if (existsSync(path.join(cwd, '.harness', 'require-e2e'))) {
  process.stderr.write(
    `Reminder: this task is marked as requiring runtime validation but no passing ` +
      `e2e run has cleared it. Run \`pnpm harness e2e\` to validate the running app ` +
      `(reads window.__app__). This is a nudge, not a block.`,
  );
}

process.exit(0);
