#!/usr/bin/env node
/**
 * Harness sensor — `impact`.
 *
 * Reports the blast radius of a change: which projects are affected, which
 * platforms (apps) are impacted, the spread by layer, and a risk hint. Wraps
 * `nx show projects --affected`. Prints JSON to stdout.
 *
 * Usage: node scripts/harness/sensors/impact.mjs [--base=<ref>] [--head=<ref>] [--root=<dir>]
 *   No flags  → impact of the current working-tree changes vs the Nx base.
 *   --base/--head → impact of a commit range (e.g. a PR).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const base = getArg('base');
const head = getArg('head');

const fail = (msg) => {
  process.stdout.write(
    JSON.stringify({ tool: 'impact', ok: false, error: msg }, null, 2) + '\n',
  );
  process.exit(1);
};

const nx = path.join(ROOT, 'node_modules', '.bin', 'nx');
if (!existsSync(nx))
  fail('nx is not installed (node_modules/.bin/nx missing).');

// 1) Affected project names from Nx (authoritative — reads real imports).
const nxArgs = ['show', 'projects', '--affected', '--json'];
if (base) nxArgs.push(`--base=${base}`);
if (head) nxArgs.push(`--head=${head}`);
const res = spawnSync(nx, nxArgs, { cwd: ROOT, encoding: 'utf8' });
if (res.status !== 0)
  fail(`nx failed: ${(res.stderr || res.stdout || '').trim().slice(0, 500)}`);

let affectedNames = [];
try {
  affectedNames = JSON.parse(res.stdout.trim() || '[]');
} catch {
  fail('Could not parse nx output as JSON.');
}

// 2) Map every project name → its layer tag (read from project.json files).
const layerByName = {};
for (const group of ['libs', 'apps']) {
  const dir = path.join(ROOT, group);
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    const pj = path.join(dir, entry, 'project.json');
    if (!existsSync(pj)) continue;
    try {
      const j = JSON.parse(readFileSync(pj, 'utf8'));
      const tag = (j.tags || []).find((t) => t.startsWith('layer:'));
      layerByName[j.name || entry] = tag
        ? tag.slice('layer:'.length)
        : 'unknown';
    } catch {
      /* skip malformed */
    }
  }
}

// 3) Classify affected projects.
const affected = affectedNames.map((name) => {
  const layer = layerByName[name] || 'unknown';
  return { project: name, layer, type: layer === 'app' ? 'app' : 'lib' };
});
const platformsAffected = affected
  .filter((a) => a.type === 'app')
  .map((a) => a.project);
const byLayer = affected.reduce(
  (acc, a) => ((acc[a.layer] = (acc[a.layer] || 0) + 1), acc),
  {},
);

// 4) Risk hint: the deeper (more foundational) the affected layer, the wider and
//    more semantically central the blast radius. Platform count is a poor signal
//    here because all apps share the web build, so nearly any lib hits all three.
const FOUNDATIONAL = new Set(['shared', 'domain', 'application']);
const OUTER_LIBS = new Set(['infrastructure', 'platform', 'ui']);
let riskHint = 'low';
if (affected.some((a) => FOUNDATIONAL.has(a.layer))) riskHint = 'high';
else if (affected.some((a) => OUTER_LIBS.has(a.layer))) riskHint = 'medium';

const report = {
  tool: 'impact',
  generatedAt: new Date().toISOString(),
  ok: true,
  range: base
    ? { base, head: head || 'working-tree' }
    : 'working-tree-vs-nx-base',
  summary: {
    affectedCount: affected.length,
    platformsAffected,
    byLayer,
    riskHint,
  },
  affected: affected.sort(
    (a, b) =>
      a.layer.localeCompare(b.layer) || a.project.localeCompare(b.project),
  ),
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(0);
