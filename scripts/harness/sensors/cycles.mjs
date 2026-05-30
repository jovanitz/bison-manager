#!/usr/bin/env node
/**
 * Harness sensor — `cycles`.
 *
 * Detects circular import dependencies (file level) via madge. ESLint's
 * enforce-module-boundaries catches cross-LAYER cycles; this catches the
 * within-layer / file-level ones it can't see. Prints JSON; exit 1 if any cycle
 * exists (so the Stop guardrail can block on it).
 *
 * Usage: node scripts/harness/sensors/cycles.mjs [--root=<dir>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const madge = path.join(ROOT, 'node_modules', '.bin', 'madge');
if (!existsSync(madge))
  emit({ tool: 'cycles', ok: true, skipped: 'madge not installed' }, 0);

const res = spawnSync(
  madge,
  [
    '--circular',
    '--json',
    '--extensions',
    'ts,tsx',
    '--ts-config',
    'tsconfig.base.json',
    'libs',
    'apps',
  ],
  { cwd: ROOT, encoding: 'utf8' },
);

// madge prints the JSON array to stdout; progress goes to stderr.
let cycles = [];
try {
  const start = res.stdout.indexOf('[');
  cycles = start >= 0 ? JSON.parse(res.stdout.slice(start)) : [];
} catch {
  emit(
    {
      tool: 'cycles',
      ok: false,
      error: (res.stderr || res.stdout || '').slice(0, 500),
    },
    1,
  );
}

emit(
  {
    tool: 'cycles',
    generatedAt: new Date().toISOString(),
    ok: cycles.length === 0,
    summary: { count: cycles.length },
    cycles: cycles.map((c) => c.join(' → ')),
  },
  cycles.length === 0 ? 0 : 1,
);
