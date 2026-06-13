#!/usr/bin/env node
/**
 * Sensor: business-rules document sync.
 *
 * docs/business-rules/access.md is GENERATED from the code (domain constants,
 * presets, the api procedure registry, and a decision matrix executed against
 * the real policy core). This sensor regenerates it in memory and fails when
 * the committed document diverges — so a business-rule change cannot land
 * without its human-readable representation changing in the same PR.
 *
 * Usage: node scripts/harness/sensors/rules.mjs [--write] [--root=<dir>]
 */
import { spawnSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : undefined;
};
const ROOT = path.resolve(
  getArg('root') ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),
);
const mode = args.includes('--write') ? '--write' : '--check';

const emit = (obj, code) => {
  // writeSync(1, …): process.exit() truncates async pipe writes at ~8 KB, so a
  // large report would reach doctor/CI as invalid JSON. Sync write can't.
  writeSync(1, JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const res = spawnSync(
  'pnpm',
  [
    'exec',
    'tsx',
    '--tsconfig',
    'tsconfig.base.json',
    'scripts/harness/rules/generate-access-rules.ts',
    mode,
  ],
  { cwd: ROOT, encoding: 'utf8' },
);

const ok = res.status === 0;
emit(
  {
    tool: 'rules',
    generatedAt: new Date().toISOString(),
    ok,
    mode: mode.replace('--', ''),
    document: 'docs/business-rules/access.md',
    output: (ok ? res.stdout : `${res.stdout}${res.stderr}`).trim(),
    hint: ok
      ? undefined
      : 'Regenerate and review the diff: pnpm harness rules --write',
  },
  ok ? 0 : 1,
);
