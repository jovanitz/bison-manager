#!/usr/bin/env node
/**
 * Harness sensor — `e2e`.
 *
 * Browser-level verification via Playwright: drives the app as a user and reads
 * the runtime introspection bridge (window.__app__). Heavy (boots the dev server
 * + a browser), so it is on-demand / its own CI job — NOT part of the Stop gate.
 * Prints JSON; exit 1 on failure.
 *
 * Usage: node scripts/harness/sensors/e2e.mjs [-- <extra playwright args>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const passthrough = args.filter((a) => !a.startsWith('--root='));

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const pw = path.join(ROOT, 'node_modules', '.bin', 'playwright');
if (!existsSync(pw))
  emit({ tool: 'e2e', ok: true, skipped: 'playwright not installed' }, 0);

const res = spawnSync(pw, ['test', ...passthrough], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env },
  maxBuffer: 20 * 1024 * 1024,
});

const ok = res.status === 0;
const output = `${res.stdout || ''}${res.stderr || ''}`.trim();

// A passing run clears the opt-in runtime-validation marker (see verify-runtime
// skill): this is the "validated at runtime" signal the Stop hook checks.
let markerCleared = false;
const marker = path.join(ROOT, '.harness', 'require-e2e');
if (ok && existsSync(marker)) {
  rmSync(marker);
  markerCleared = true;
}

emit(
  {
    tool: 'e2e',
    generatedAt: new Date().toISOString(),
    ok,
    markerCleared,
    output: ok ? output.slice(-600) : output.slice(-4000),
  },
  ok ? 0 : 1,
);
