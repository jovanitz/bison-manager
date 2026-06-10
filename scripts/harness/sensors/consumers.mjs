#!/usr/bin/env node
/**
 * Harness sensor — `consumers`.
 *
 * File-level blast radius: given changed (or named) files, who imports them —
 * directly and transitively. Finer than `impact` (which is project-level and
 * drives the gate); use this to focus review and to check what a signature
 * change will reach. Cross-package edges are followed through the barrel
 * (`@acme/*` -> libs/<pkg>/src/index.ts). Prints JSON; never blocks.
 *
 * Usage: node scripts/harness/sensors/consumers.mjs [<file>…] [--root=<dir>]
 *   No files -> uses the files changed vs HEAD (plus untracked).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const named = args.filter((a) => !a.startsWith('--'));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const abs = (r) => path.resolve(ROOT, r);
const layerOf = (r) => r.match(/^(?:libs|apps)\/([^/]+)\//)?.[1] ?? 'unknown';

// @acme/* -> barrel entry, from tsconfig.base.json paths.
const aliasMap = (() => {
  try {
    const paths = JSON.parse(
      readFileSync(path.join(ROOT, 'tsconfig.base.json'), 'utf8'),
    ).compilerOptions.paths;
    const m = {};
    for (const [k, [v]] of Object.entries(paths)) m[k] = abs(v);
    return m;
  } catch {
    return {};
  }
})();

const CODE = /\.(ts|tsx)$/;
const IGNORE = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    if (IGNORE.has(e)) return [];
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return CODE.test(e) ? [full] : [];
  });
};
const files = ['libs', 'apps'].flatMap((d) => walk(path.join(ROOT, d)));

const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const candidates = (base) => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  path.join(base, 'index.ts'),
  path.join(base, 'index.tsx'),
];
const isFile = (c) => existsSync(c) && statSync(c).isFile();
const resolveSpec = (spec, fromDir) => {
  if (spec.startsWith('.')) {
    // Require a FILE: a bare directory path must resolve to its index, not the dir.
    for (const c of candidates(path.resolve(fromDir, spec)))
      if (isFile(c)) return path.resolve(c);
  } else if (aliasMap[spec]) {
    return aliasMap[spec];
  }
  return null;
};

// Reverse graph: target file -> Set(importer files).
const importers = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    const target = resolveSpec(spec, path.dirname(f));
    if (!target) continue;
    if (!importers.has(target)) importers.set(target, new Set());
    importers.get(target).add(path.resolve(f));
  }
}

// Targets: named files, or files changed vs HEAD (+ untracked).
const targets = (() => {
  if (named.length) return named.map(abs);
  const git = (a) =>
    spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  const changed = [
    ...git(['diff', '--name-only', 'HEAD']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ];
  return [...new Set(changed)]
    .filter((r) => CODE.test(r) && /^(libs|apps)\//.test(r))
    .map(abs);
})();

const transitive = (target) => {
  const seen = new Map(); // file -> depth
  let frontier = [[target, 0]];
  while (frontier.length) {
    const next = [];
    for (const [file, depth] of frontier) {
      for (const imp of importers.get(file) ?? []) {
        if (!seen.has(imp)) {
          seen.set(imp, depth + 1);
          next.push([imp, depth + 1]);
        }
      }
    }
    frontier = next;
  }
  return seen;
};

const results = targets.map((t) => {
  const direct = [...(importers.get(t) ?? [])].map(rel).sort();
  const all = transitive(t);
  const byLayer = {};
  const consumers = [...all.entries()]
    .map(([file, depth]) => ({
      file: rel(file),
      layer: layerOf(rel(file)),
      depth,
    }))
    .sort((a, b) => a.depth - b.depth || a.file.localeCompare(b.file));
  for (const c of consumers) byLayer[c.layer] = (byLayer[c.layer] || 0) + 1;
  return {
    file: rel(t),
    directImporters: direct,
    transitiveCount: consumers.length,
    byLayer,
    consumers,
  };
});

process.stdout.write(
  JSON.stringify(
    {
      tool: 'consumers',
      generatedAt: new Date().toISOString(),
      ok: true,
      basis: named.length ? 'named-files' : 'changed-vs-HEAD',
      summary: { targets: results.length },
      results,
    },
    null,
    2,
  ) + '\n',
);
// exitCode (not exit()) lets stdout drain — exit() truncates pipes at ~8 KB.
process.exitCode = 0;
