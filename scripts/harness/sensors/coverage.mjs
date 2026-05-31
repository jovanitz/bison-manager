#!/usr/bin/env node
/**
 * Harness sensor — `coverage`.
 *
 * Runs the test suite with V8 coverage and enforces a per-layer line-coverage
 * floor on the PORTABLE CORE (domain + application) — the layers the
 * architecture claims are pure and fully testable. Adapters (infra/platform),
 * wiring (apps) and design-system are intentionally not gated here (they are
 * covered by contract/component tests or integration, not unit %).
 *
 * Prints JSON; exit 1 if any layer is below its floor. Slower than other sensors
 * (it runs the suite), so it is a CI/on-demand gate, not part of the Stop hook.
 *
 * Usage: node scripts/harness/sensors/coverage.mjs [--min-domain=90] [--min-application=75] [--root=<dir>]
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const floors = {
  domain: Number(getArg('min-domain', '90')),
  application: Number(getArg('min-application', '75')),
};

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const vitest = path.join(ROOT, 'node_modules', '.bin', 'vitest');
if (!existsSync(vitest))
  emit({ tool: 'coverage', ok: false, error: 'vitest not installed' }, 1);

const reportsDir = path.join(tmpdir(), `harness-cov-${process.pid}`);
const res = spawnSync(
  vitest,
  [
    'run',
    '--coverage',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    `--coverage.reportsDirectory=${reportsDir}`,
  ],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    maxBuffer: 10 * 1024 * 1024,
  },
);

const summaryPath = path.join(reportsDir, 'coverage-summary.json');
if (!existsSync(summaryPath)) {
  emit(
    {
      tool: 'coverage',
      ok: false,
      error: (res.stderr || res.stdout || '').slice(-800),
    },
    1,
  );
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const agg = {};
for (const [file, m] of Object.entries(summary)) {
  if (file === 'total') continue;
  const layer = (file.match(/\/libs\/([^/]+)\//) ||
    file.match(/\/apps\/([^/]+)\//) ||
    [])[1];
  if (!layer) continue;
  agg[layer] = agg[layer] || { total: 0, covered: 0 };
  agg[layer].total += m.lines.total;
  agg[layer].covered += m.lines.covered;
}

const pct = (l) => (agg[l]?.total ? (agg[l].covered / agg[l].total) * 100 : 0);
const byLayer = Object.fromEntries(
  Object.keys(agg).map((l) => [l, Number(pct(l).toFixed(1))]),
);

const violations = Object.entries(floors)
  .map(([layer, min]) => ({
    layer,
    min,
    actual: Number(pct(layer).toFixed(1)),
  }))
  .filter((v) => v.actual < v.min);

emit(
  {
    tool: 'coverage',
    generatedAt: new Date().toISOString(),
    ok: violations.length === 0,
    floors,
    byLayer,
    violations,
  },
  violations.length === 0 ? 0 : 1,
);
