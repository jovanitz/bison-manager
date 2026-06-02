#!/usr/bin/env node
/**
 * Harness sensor — `doctor`.
 *
 * Self-check of the harness itself: hooks wired, scripts present, the CLI
 * registry consistent, capabilities.json in sync with the ESLint boundary
 * rules, and git available (needed by affected-based sensors). Run it before
 * starting real work, or after touching the harness. Prints JSON; exit 1 if any
 * check fails.
 *
 * Usage: node scripts/harness/sensors/doctor.mjs [--root=<dir>]
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

// 1) Hook scripts exist and are wired in settings.json.
const HOOK_FILES = [
  'session-context',
  'prompt-reminder',
  'pre-edit-guard',
  'post-edit-check',
  'quality-gate',
].map((h) => `scripts/harness/hooks/${h}.mjs`);
let settings = '';
try {
  settings = read('.claude/settings.json');
} catch {
  /* missing */
}
check('settings.json present', !!settings);
for (const h of HOOK_FILES) {
  const base = path.basename(h);
  check(`hook ${base} exists`, exists(h));
  check(`hook ${base} wired`, settings.includes(base));
}

// 2) CLI commands map to existing scripts.
let cli = '';
try {
  cli = read('scripts/harness/cli.mjs');
} catch {
  /* missing */
}
check('cli.mjs present', !!cli);
const EXPECTED = {
  gaps: 'sensors/gaps.mjs',
  impact: 'sensors/impact.mjs',
  perf: 'sensors/perf.mjs',
  quality: 'sensors/quality.mjs',
  structure: 'sensors/structure.mjs',
  cycles: 'sensors/cycles.mjs',
  consumers: 'sensors/consumers.mjs',
  'dead-code': 'sensors/dead-code.mjs',
  coverage: 'sensors/coverage.mjs',
  e2e: 'sensors/e2e.mjs',
  audit: 'sensors/audit.mjs',
  'skill-scan': 'sensors/skill-scan.mjs',
  doctor: 'sensors/doctor.mjs',
  'generate-feature': 'generators/generate-feature.mjs',
};
for (const [cmd, rel] of Object.entries(EXPECTED)) {
  check(`command "${cmd}" script exists`, exists(`scripts/harness/${rel}`));
  check(`command "${cmd}" registered`, cli.includes(rel));
}

// 3) capabilities.json in sync with ESLint enforce-module-boundaries.
try {
  const caps = JSON.parse(read('docs/ai/capabilities.json')).layers;
  const eslint = read('eslint.config.mjs');
  const re =
    /sourceTag:\s*'layer:([\w-]+)'[\s\S]*?onlyDependOnLibsWithTags:\s*\[([\s\S]*?)\]/g;
  const eslintMap = {};
  let m;
  while ((m = re.exec(eslint))) {
    const tags = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    eslintMap[m[1]] = tags.includes('*')
      ? new Set(['*'])
      : new Set(tags.map((t) => t.replace('layer:', '')));
  }
  for (const [layer, def] of Object.entries(caps)) {
    const fromEslint = eslintMap[layer];
    if (!fromEslint) {
      check(
        `capabilities[${layer}] has an ESLint rule`,
        false,
        'no matching sourceTag',
      );
      continue;
    }
    const expected = fromEslint.has('*')
      ? new Set(['*'])
      : new Set([layer, ...def.mayImport]);
    const a = [...expected].sort().join(',');
    const b = [...fromEslint].sort().join(',');
    check(
      `capabilities[${layer}] matches ESLint`,
      a === b,
      a === b ? '' : `caps={${a}} eslint={${b}}`,
    );
  }
} catch (e) {
  check('capabilities/eslint comparable', false, String(e).slice(0, 120));
}

// 4) git available (affected-based sensors need it).
check('git repo present', exists('.git'));

// 5) Smoke-test the fast, read-only sensors: each must run and emit valid JSON
//    tagged with its own name. Catches a silently-broken sensor (e.g. a syntax
//    error or a bad byte) that no other gate would notice. Exit code is ignored
//    on purpose — ok:false is a finding, not a broken sensor.
const SMOKE = [
  'gaps',
  'impact',
  'structure',
  'cycles',
  'consumers',
  'dead-code',
  'skill-scan',
];
for (const name of SMOKE) {
  const script = path.join(ROOT, 'scripts/harness/sensors', `${name}.mjs`);
  if (!existsSync(script)) {
    check(`sensor ${name} runs`, false, 'script missing');
    continue;
  }
  const res = spawnSync(process.execPath, [script, `--root=${ROOT}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    /* invalid */
  }
  check(
    `sensor ${name} runs`,
    !!parsed && parsed.tool === name,
    parsed ? '' : (res.stderr || 'no valid JSON output').slice(0, 120),
  );
}

const failed = checks.filter((c) => !c.ok);
process.stdout.write(
  JSON.stringify(
    {
      tool: 'doctor',
      generatedAt: new Date().toISOString(),
      ok: failed.length === 0,
      summary: { total: checks.length, failed: failed.length },
      checks,
    },
    null,
    2,
  ) + '\n',
);
process.exit(failed.length ? 1 : 0);
