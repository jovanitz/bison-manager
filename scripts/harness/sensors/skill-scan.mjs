#!/usr/bin/env node
/**
 * Harness sensor — `skill-scan`.
 *
 * Scans the AI-agent surface (Claude skills, MCP servers, harness scripts) for
 * agent-specific risks — prompt injection, hidden instructions, tool poisoning,
 * excessive agency, dangerous code — via NVIDIA SkillSpector. Complements `audit`
 * (which covers dependency CVEs). Most valuable before trusting third-party
 * skills/MCP. Prints JSON; exits 1 if SkillSpector reports findings.
 *
 * SkillSpector is a Python tool (pip/uv) and is NOT a project dependency: if it
 * is not on PATH the sensor SKIPS gracefully (ok:true) so devs without it aren't
 * blocked. Install: https://github.com/NVIDIA/SkillSpector
 *
 * Usage: node scripts/harness/sensors/skill-scan.mjs [--root=<dir>]
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
  // writeSync(1, …): process.exit() truncates async pipe writes at ~8 KB, so a
  // large report would reach doctor/CI as invalid JSON. Sync write can't.
  writeSync(1, JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

// Graceful skip if SkillSpector isn't installed (it's an optional Python tool).
const has = spawnSync('skillspector', ['--version'], { encoding: 'utf8' });
if (has.error) {
  emit(
    {
      tool: 'skill-scan',
      ok: true,
      skipped:
        'skillspector not installed (optional Python tool) — see https://github.com/NVIDIA/SkillSpector',
    },
    0,
  );
}

// Scan the agent surface that exists in this repo.
const targets = ['.claude/skills', 'scripts/harness'].filter((t) =>
  existsSync(path.join(ROOT, t)),
);
const res = spawnSync(
  'skillspector',
  ['scan', ...targets, '--format', 'json', '--no-llm'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);

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
      tool: 'skill-scan',
      ok: false,
      error: (res.stderr || res.stdout || '').slice(0, 800),
    },
    1,
  );
}

// SkillSpector's JSON shape varies by version; surface the findings array if
// present and fall back to a raw count otherwise.
const findings = report.findings ?? report.issues ?? report.results ?? [];
const ok = Array.isArray(findings)
  ? findings.length === 0
  : !report.has_findings;

emit(
  {
    tool: 'skill-scan',
    generatedAt: new Date().toISOString(),
    ok,
    targets,
    summary: {
      findings: Array.isArray(findings) ? findings.length : 'unknown',
    },
    findings: Array.isArray(findings) ? findings.slice(0, 50) : report,
  },
  ok ? 0 : 1,
);
