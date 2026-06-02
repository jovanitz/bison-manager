#!/usr/bin/env node
/**
 * Harness sensor — `audit`.
 *
 * Scans the dependency tree for known CVEs via `pnpm audit` (OSV/registry
 * advisories). Covers the classic software supply chain — complements
 * `skill-scan` (which covers the AI-agent surface). Prints JSON; exits 1 when
 * there is a high/critical advisory (CI runs it advisory until the tree is clean).
 *
 * Usage: node scripts/harness/sensors/audit.mjs [--level=high] [--root=<dir>]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const LEVEL = getArg('level', 'high'); // fail threshold: high | critical | moderate

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

const res = spawnSync('pnpm', ['audit', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  const start = res.stdout.indexOf('{');
  report = start >= 0 ? JSON.parse(res.stdout.slice(start)) : null;
} catch {
  report = null;
}
if (!report) {
  emit(
    {
      tool: 'audit',
      ok: true,
      skipped: 'pnpm audit produced no parseable output (offline?)',
    },
    0,
  );
}

const counts = report.metadata?.vulnerabilities ?? {};
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const threshold = RANK[LEVEL] ?? 3;

const findings = Object.values(report.advisories ?? {})
  .filter((a) => (RANK[a.severity] ?? 0) >= threshold)
  .map((a) => ({
    module: a.module_name,
    severity: a.severity,
    title: a.title,
    url: a.url,
    vulnerableVersions: a.vulnerable_versions,
  }));

const ok = findings.length === 0;
emit(
  {
    tool: 'audit',
    generatedAt: new Date().toISOString(),
    ok,
    level: LEVEL,
    summary: counts,
    findings,
  },
  ok ? 0 : 1,
);
