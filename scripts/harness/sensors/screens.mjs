#!/usr/bin/env node
/**
 * Harness sensor — `screens`.
 *
 * Makes the harness phase-aware for UI views — the two-phase, zero-rework
 * workflow (see docs/ai/screens.md). A view is `<name>.view.tsx`: a pure
 * function of `(ViewModel + actions)` composing the design system. Each view
 * carries a phase tag in its top JSDoc, and THAT is the machine-readable source
 * of truth the harness reads:
 *
 *   @phase draft     → still being designed at the UI level  ("arma la vista X")
 *   @phase approved  → signed off, ready to wire            ("impleméntala X")
 *
 * Rules:
 *   any phase → must carry a valid @phase; must have a *.view.stories.tsx; must
 *               NOT import architecture (application/domain/infra/platform/DI/
 *               stores) — the view stays presentational in BOTH phases.
 *   draft     → a *.container.tsx present is a warning (wiring the unapproved).
 *   approved  → a *.container.tsx MUST exist (the wiring seam that feeds the VM).
 *
 * Prints JSON; exit 1 on any high-severity violation (the Stop guardrail blocks
 * on it). Usage: node scripts/harness/sensors/screens.mjs [--root=<dir>]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import harnessConfig from '../../../harness.config.mjs';

const cfg = harnessConfig.screens ?? {};
const VIEW_SUFFIX = cfg.viewSuffix ?? '.view.tsx';
const SCAN = cfg.scan ?? ['libs/ui/src'];
const REQUIRE_STORY = cfg.requireStory ?? true;
const REQUIRE_CONTAINER = cfg.requireContainerWhenApproved ?? true;
const BANNED = cfg.presentationalBannedImports ?? [
  '@acme/application',
  '@acme/domain',
  '@acme/infrastructure',
  '@acme/platform',
  '/di/',
  'use-cases-context',
  '.store',
];

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const IGNORE = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

const views = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    if (IGNORE.has(e)) continue;
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith(VIEW_SUFFIX)) views.push(full);
  }
};
SCAN.map((d) => path.join(ROOT, d)).forEach(walk);

const PHASE_RE = /@phase\s+(draft|approved)\b/;
const importPaths = (src) =>
  [...src.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );

const screens = [];
const violations = [];
const add = (severity, file, detail) =>
  violations.push({ severity, path: file, detail });

for (const full of views) {
  const src = readFileSync(full, 'utf8');
  const r = rel(full);
  const base = full.slice(0, -VIEW_SUFFIX.length);
  const phase = src.match(PHASE_RE)?.[1] ?? null;
  const hasStory =
    existsSync(`${base}.view.stories.tsx`) || existsSync(`${base}.stories.tsx`);
  const hasContainer = existsSync(`${base}.container.tsx`);
  const leaks = [
    ...new Set(
      importPaths(src).filter((s) => BANNED.some((b) => s.includes(b))),
    ),
  ];

  if (!phase)
    add(
      'high',
      r,
      'Missing @phase tag — add `@phase draft` or `@phase approved` to the view JSDoc.',
    );
  if (leaks.length)
    add(
      'high',
      r,
      `Presentational view imports architecture: ${leaks.join(', ')}. Data/wiring belongs in a *.container.tsx, not the view.`,
    );
  if (REQUIRE_STORY && !hasStory)
    add(
      'high',
      r,
      'No *.view.stories.tsx — every view needs a Storybook story (design + parity).',
    );
  if (phase === 'approved' && REQUIRE_CONTAINER && !hasContainer)
    add(
      'high',
      r,
      'approved view has no *.container.tsx — wire the ViewModel (selector) + actions before marking it approved.',
    );
  if (phase === 'draft' && hasContainer)
    add(
      'warn',
      r,
      'draft view has a *.container.tsx — you are wiring something not yet approved (flip to @phase approved first).',
    );

  screens.push({
    view: r,
    phase: phase ?? 'unmarked',
    hasStory,
    hasContainer,
    leaks,
  });
}

const high = violations.filter((v) => v.severity === 'high').length;
process.stdout.write(
  JSON.stringify(
    {
      tool: 'screens',
      generatedAt: new Date().toISOString(),
      ok: high === 0,
      summary: {
        views: views.length,
        draft: screens.filter((s) => s.phase === 'draft').length,
        approved: screens.filter((s) => s.phase === 'approved').length,
        unmarked: screens.filter((s) => s.phase === 'unmarked').length,
        violations: violations.length,
      },
      screens,
      violations,
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = high ? 1 : 0;
