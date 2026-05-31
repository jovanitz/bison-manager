#!/usr/bin/env node
/**
 * Harness sensor — `dead-code`.
 *
 * Finds unused code (orphaned files, unused exports/types, duplicate exports) via
 * knip. Complements `gaps` (which finds untested code): this finds code nothing
 * imports. Dependency/binary checks are off (noisy in an Nx monorepo) — see
 * knip.json. Prints JSON; exit 1 if anything is dead.
 *
 * Usage: node scripts/harness/sensors/dead-code.mjs [--root=<dir>]
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

const knip = path.join(ROOT, 'node_modules', '.bin', 'knip');
if (!existsSync(knip))
  emit({ tool: 'dead-code', ok: true, skipped: 'knip not installed' }, 0);

const res = spawnSync(knip, ['--reporter', 'json', '--no-progress'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

let issues = [];
try {
  const start = res.stdout.indexOf('{');
  issues = start >= 0 ? (JSON.parse(res.stdout.slice(start)).issues ?? []) : [];
} catch {
  emit(
    {
      tool: 'dead-code',
      ok: false,
      error: (res.stderr || res.stdout || '').slice(0, 500),
    },
    1,
  );
}

// Flatten knip's per-file issues into a flat findings list.
const findings = [];
const names = (arr) =>
  Array.isArray(arr) ? arr.map((x) => x?.name ?? x).filter(Boolean) : [];
for (const i of issues) {
  const file = i.file ?? '(unknown)';
  if (i.files) findings.push({ type: 'unused-file', file });
  for (const n of names(i.exports))
    findings.push({ type: 'unused-export', file, name: n });
  for (const n of names(i.types))
    findings.push({ type: 'unused-type', file, name: n });
  for (const n of names(i.nsExports))
    findings.push({ type: 'unused-export', file, name: n });
  for (const n of names(i.duplicates))
    findings.push({ type: 'duplicate-export', file, name: n });
}

const countBy = (k) =>
  findings.reduce((a, f) => ((a[f[k]] = (a[f[k]] || 0) + 1), a), {});

emit(
  {
    tool: 'dead-code',
    generatedAt: new Date().toISOString(),
    ok: findings.length === 0,
    summary: { total: findings.length, byType: countBy('type') },
    findings,
  },
  findings.length === 0 ? 0 : 1,
);
