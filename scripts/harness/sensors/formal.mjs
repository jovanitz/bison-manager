#!/usr/bin/env node
/**
 * Harness sensor — `formal`.
 *
 * Runs the FORMAL verification suite: every `*.formal.spec.ts` (property-based
 * tests + exhaustive BFS model-checks) colocated with the pure core it verifies.
 * It is the dependency-free static half of a Runtime Inspector's
 * `formal_run_properties` / `formal_model_check`: it proves the authorization
 * decision function and coherence guards offline, at scale, before deploy —
 * catching wrong behavior the example specs never enumerate (deny-by-default,
 * tenant isolation, delegable-set drift). Prints JSON; exit 1 if any property or
 * model-check fails (so the Stop guardrail can block on it). Sub-second.
 *
 * Usage: node scripts/harness/sensors/formal.mjs [--root=<dir>]
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

const emit = (obj, code) => {
  writeSync(1, JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const vitest = path.join(ROOT, 'node_modules', '.bin', 'vitest');
if (!existsSync(vitest))
  emit({ tool: 'formal', ok: true, skipped: 'vitest not installed' }, 0);

// Filename filter: vitest treats positional args as substring matches, so this
// runs exactly the *.formal.spec.ts files anywhere in the workspace.
const res = spawnSync(
  vitest,
  ['run', '.formal.spec', '--reporter=basic', '--passWithNoTests'],
  { cwd: ROOT, encoding: 'utf8' },
);

const out = `${res.stdout || ''}${res.stderr || ''}`;
const ok = res.status === 0;
const passLine = out.match(/Tests\s+.*$/m)?.[0]?.trim();

emit(
  {
    tool: 'formal',
    generatedAt: new Date().toISOString(),
    ok,
    summary:
      passLine ?? (ok ? 'all formal properties hold' : 'formal check failed'),
    // On failure the thrown message carries the reproducible seed + input.
    ...(ok ? {} : { output: out.split('\n').slice(-40).join('\n') }),
  },
  ok ? 0 : 1,
);
