#!/usr/bin/env node
/**
 * Harness sensor — `e2e-auth`.
 *
 * The front↔back AUTH e2e: drives the real web app against the REAL backend
 * (local Supabase + the API) and signs in for real. It is the only level that
 * exercises the live frontend↔backend seam. Runs Playwright with the dedicated
 * heavy config (playwright.auth.config.ts), whose global-setup boots Supabase
 * (Docker) + seeds the bootstrap-owner user; the API + web come up as webServers.
 *
 * Separate from `e2e` on purpose: that one is cheap (web only), this one is
 * Docker-dependent. Heavy + on-demand — NEVER part of the Stop gate. Prints JSON;
 * exit 1 on failure. Skips cleanly if Playwright isn't installed.
 *
 * Usage: node scripts/harness/sensors/e2e-auth.mjs [--root=<dir>] [-- <extra playwright args>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const passthrough = args.filter((a) => !a.startsWith('--root='));

const emit = (obj, code) => {
  // writeSync(1, …): process.exit() truncates async pipe writes at ~8 KB, so a
  // large report would reach doctor/CI as invalid JSON. Sync write can't.
  writeSync(1, JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const pw = path.join(ROOT, 'node_modules', '.bin', 'playwright');
if (!existsSync(pw))
  emit({ tool: 'e2e-auth', ok: true, skipped: 'playwright not installed' }, 0);

const res = spawnSync(
  pw,
  ['test', '--config=playwright.auth.config.ts', ...passthrough],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 20 * 1024 * 1024,
  },
);

const ok = res.status === 0;
const output = `${res.stdout || ''}${res.stderr || ''}`.trim();

emit(
  {
    tool: 'e2e-auth',
    generatedAt: new Date().toISOString(),
    ok,
    output: ok ? output.slice(-600) : output.slice(-4000),
  },
  ok ? 0 : 1,
);
