#!/usr/bin/env node
/**
 * Harness sensor — `gaps`.
 *
 * Statically finds development gaps the architecture makes mechanically
 * detectable: adapters/use-cases with no spec exercising them, screens & domain
 * logic without tests, and TODO markers. No tests are executed, so it is fast
 * and deterministic. Prints JSON to stdout.
 *
 * Usage: node scripts/harness/sensors/gaps.mjs [--layer=<name>] [--root=<dir>]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const LAYER_FILTER = getArg('layer');

// Optional ignore list: scripts/harness/harness-ignore.json -> { "gaps": [glob] }.
// Plus an inline `// harness-ignore` annotation in any file. Lets you silence
// intentional gaps (e.g. template reference adapters) so the signal stays clean.
const globToRegExp = (glob) => {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else if ('.+?^${}()|[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
};
const IGNORE_GLOBS = (() => {
  const cfg = path.join(ROOT, 'scripts/harness/harness-ignore.json');
  if (!existsSync(cfg)) return [];
  try {
    return (JSON.parse(readFileSync(cfg, 'utf8')).gaps || []).map(globToRegExp);
  } catch {
    return [];
  }
})();

const SCAN_DIRS = ['libs', 'apps'].map((d) => path.join(ROOT, d));
const IGNORE = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const CODE_EXT = /\.(ts|tsx)$/;
const SPEC_EXT = /\.spec\.(ts|tsx)$/;

/** Recursively list code files under a dir. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (CODE_EXT.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const layerOf = (f) => {
  const r = rel(f);
  const m = r.match(/^(?:libs|apps)\/([^/]+)\//);
  return m ? m[1] : 'unknown';
};

const allFiles = SCAN_DIRS.flatMap(walk);
const specFiles = allFiles.filter((f) => SPEC_EXT.test(f));
const sourceFiles = allFiles.filter(
  (f) => !SPEC_EXT.test(f) && !/test-setup\./.test(f),
);

// Build the set of source files imported (directly) by any spec — these are
// "exercised by a test". Resolve relative import specifiers to absolute paths.
const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const tested = new Set();
const candidatesFor = (base) => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  path.join(base, 'index.ts'),
  path.join(base, 'index.tsx'),
];
for (const spec of specFiles) {
  const src = readFileSync(spec, 'utf8');
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec2 = m[1] || m[2];
    if (!spec2 || !spec2.startsWith('.')) continue; // only relative imports
    const resolved = path.resolve(path.dirname(spec), spec2);
    for (const c of candidatesFor(resolved))
      if (existsSync(c)) tested.add(path.resolve(c));
  }
}

const hasSiblingSpec = (f) => {
  const base = f.replace(CODE_EXT, '');
  return existsSync(`${base}.spec.ts`) || existsSync(`${base}.spec.tsx`);
};
const isExercised = (f) => tested.has(path.resolve(f)) || hasSiblingSpec(f);

/** A file is ignored if its path matches an ignore glob or it carries the annotation. */
const isIgnored = (f) => {
  const r = rel(f);
  if (IGNORE_GLOBS.some((re) => re.test(r))) return true;
  return readFileSync(f, 'utf8').includes('harness-ignore');
};

const gaps = [];
const add = (type, severity, file, message, suggestion) =>
  gaps.push({
    type,
    severity,
    layer: layerOf(file),
    file: rel(file),
    message,
    suggestion,
  });

const ADAPTER_DIR =
  /\/(?:infrastructure\/src\/(?:api|persistence|sync|auth)|platform\/src\/(?:browser|capacitor|tauri))\//;

for (const f of sourceFiles) {
  const r = rel(f);
  const base = path.basename(f);
  if (base.startsWith('index.') || base === 'errors.ts' || base === 'dto.ts')
    continue;
  if (isIgnored(f)) continue;

  // 1) Real adapters with no spec importing them.
  if (
    ADAPTER_DIR.test(f) &&
    !/^(in-memory|fake)/.test(base) &&
    !/contract/.test(base)
  ) {
    const content = readFileSync(f, 'utf8');
    if (
      /export\s+(?:const|function)\s+create/.test(content) &&
      !isExercised(f)
    ) {
      add(
        'untested-adapter',
        'high',
        f,
        'Adapter is not exercised by any contract/spec test.',
        'Register this adapter in the relevant contract test (e.g. testing/*-contract.ts) and add a .spec that runs it.',
      );
      continue;
    }
  }

  // 2) Use-case files with no spec.
  if (/use-cases?\.ts$/.test(base) && !isExercised(f)) {
    add(
      'untested-use-case',
      'high',
      f,
      'Use case has no headless spec.',
      'Add a Vitest spec wiring the use case to in-memory adapters (see application/src/example/use-cases.spec.ts).',
    );
    continue;
  }

  // 3) Screens without a component test.
  if (/-screen\.tsx$/.test(base) && !isExercised(f)) {
    add(
      'untested-screen',
      'medium',
      f,
      'Screen has no component test.',
      'Add a *-screen.spec.tsx rendering it against mock use cases (see ui/src/example/item-screen.spec.tsx).',
    );
    continue;
  }

  // 4) Domain logic without a spec.
  if (layerOf(f) === 'domain' && !isExercised(f)) {
    const content = readFileSync(f, 'utf8');
    if (/export\s+(?:const|function)\s/.test(content)) {
      add(
        'untested-domain',
        'medium',
        f,
        'Domain logic has no unit spec.',
        'Add a .spec.ts asserting the rules/value-object invariants for this module.',
      );
    }
  }
}

// 5) TODO / FIXME markers.
const TODO_RE = /\b(TODO|FIXME|XXX|HACK)\b/;
for (const f of sourceFiles) {
  if (isIgnored(f)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (TODO_RE.test(line)) {
      add(
        'todo',
        'low',
        f,
        `Marker at line ${i + 1}: ${line.trim().slice(0, 120)}`,
        'Resolve or convert to a tracked task.',
      );
    }
  });
}

const filtered = LAYER_FILTER
  ? gaps.filter((g) => g.layer === LAYER_FILTER)
  : gaps;
const countBy = (key) =>
  filtered.reduce(
    (acc, g) => ((acc[g[key]] = (acc[g[key]] || 0) + 1), acc),
    {},
  );

const report = {
  tool: 'gaps',
  generatedAt: new Date().toISOString(),
  ok: filtered.filter((g) => g.severity === 'high').length === 0,
  summary: {
    total: filtered.length,
    byType: countBy('type'),
    bySeverity: countBy('severity'),
  },
  gaps: filtered.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (
      order[a.severity] - order[b.severity] || a.file.localeCompare(b.file)
    );
  }),
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
// Exit non-zero on a high-severity gap (untested use case/adapter) so the Stop
// guardrail and CI can block on it — this is the TDD enforcement.
process.exit(report.ok ? 0 : 1);
