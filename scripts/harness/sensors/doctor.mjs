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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TOOLS } from '../manifest.mjs';
import harnessConfig from '../../../harness.config.mjs';

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
check(
  'cli.mjs dispatches from the manifest',
  /manifest\.mjs/.test(cli),
  'the CLI must import scripts/harness/manifest.mjs (the single source of truth)',
);
// The manifest (manifest.mjs) is the single source of truth. Every sensor/
// generator file must be declared there — so it's reachable from `pnpm harness`
// (Codex/CI/humans, not Claude-only) — and every declared script must exist.
const discovered = [];
for (const group of ['sensors', 'generators']) {
  const dir = path.join(ROOT, 'scripts/harness', group);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir))
    if (f.endsWith('.mjs')) discovered.push(`${group}/${f}`);
}
const registered = TOOLS.map((t) => t.script);
for (const rel of discovered) {
  check(
    `script ${rel} is declared in the manifest`,
    registered.includes(rel),
    'add it to scripts/harness/manifest.mjs — else it is not reachable by Codex/CI',
  );
}
for (const rel of registered) {
  check(`manifest tool script ${rel} exists`, exists(`scripts/harness/${rel}`));
}

// 3) capabilities.json in sync with ESLint enforce-module-boundaries.
// Project-specific (layer-tagged boundaries) — declared in harness.config.mjs;
// a project without it skips this check, keeping doctor portable.
const capCheck = harnessConfig.capabilitiesCheck;
if (capCheck)
  try {
    const caps = JSON.parse(read(capCheck.capabilities)).layers;
    const eslint = read(capCheck.eslint);
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

// 6) Portability — the harness must work for non-Claude agents (e.g. Codex) too.
//    Codex reads AGENTS.md; and no capability may be Claude-only — every skill
//    must map to a `pnpm harness <cmd>` so it is reachable from the plain CLI.
check('AGENTS.md present (Codex entry point)', exists('AGENTS.md'));
const agents = exists('AGENTS.md') ? read('AGENTS.md') : '';
check('AGENTS.md documents the CLI gate', agents.includes('pnpm harness'));
check('AGENTS.md points to shared rules (docs/ai)', agents.includes('docs/ai'));
// Anti-drift: AGENTS.md must DELEGATE to the canonical, derived sources rather
// than carry a stale copy — the manifest-derived gate + the authoritative rules.
// So it can't silently diverge from CLAUDE.md as tools/rules evolve.
check(
  'AGENTS.md delegates the gate to `harness check` (no drifting && chain)',
  /harness check/.test(agents),
  'point other agents at `pnpm harness check` (derives from the manifest)',
);
check(
  'AGENTS.md references capabilities.json (rules, not a copy)',
  agents.includes('capabilities.json'),
  'link docs/ai/capabilities.json so AGENTS.md cannot drift from the real rules',
);

// Agent-agnostic git hooks (fire for Codex/humans too) + their wiring.
check('git hook .githooks/pre-commit present', exists('.githooks/pre-commit'));
check('git hook .githooks/pre-push present', exists('.githooks/pre-push'));
let pkg = {};
try {
  pkg = JSON.parse(read('package.json'));
} catch {
  /* ignore */
}
check(
  'package.json wires git hooks (prepare → core.hooksPath)',
  /core\.hooksPath\s+\.githooks/.test(pkg.scripts?.prepare ?? ''),
);
check(
  'package.json has a `gate` script',
  typeof pkg.scripts?.gate === 'string',
);

const skillsDir = path.join(ROOT, '.claude/skills');
if (existsSync(skillsDir)) {
  for (const name of readdirSync(skillsDir)) {
    const skill = path.join(skillsDir, name, 'SKILL.md');
    if (!existsSync(skill)) continue;
    const body = readFileSync(skill, 'utf8');
    check(
      `skill "${name}" maps to a CLI command (Codex-portable)`,
      /pnpm harness/.test(body),
      'add a `pnpm harness <cmd>` the skill wraps, so it is not Claude-only',
    );
  }
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
// exitCode (not exit()) lets stdout drain — exit() truncates pipes at ~8 KB.
process.exitCode = failed.length ? 1 : 0;
