#!/usr/bin/env node
/**
 * Harness sensor — `purity` (project shim over @harness/core).
 *
 * Asserts the configured pure layers (domain/application/flows) are free of
 * side effects / non-determinism the import-ban can't catch. Prints JSON; exit
 * 1 on any violation so the Stop guardrail can block on it.
 *
 * Usage: node scripts/harness/sensors/purity.mjs [--root=<dir>]
 */
import { writeSync } from 'node:fs';
import path from 'node:path';
import harnessConfig from '../../../harness.config.mjs';
import { runPurity } from '../../../tools/harness/src/sensors/purity.mjs';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const root = path.resolve(getArg('root') || process.cwd());
const cfg = harnessConfig.purity ?? { layers: [], exclude: [] };

const { ok, violations } = runPurity({
  root,
  layers: cfg.layers,
  exclude: cfg.exclude,
});

writeSync(
  1,
  JSON.stringify(
    {
      tool: 'purity',
      generatedAt: new Date().toISOString(),
      ok,
      summary: { violations: violations.length, layers: cfg.layers },
      violations,
    },
    null,
    2,
  ) + '\n',
);
process.exit(ok ? 0 : 1);
