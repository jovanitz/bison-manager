#!/usr/bin/env node
/**
 * Harness generator — `generate-feature`.
 *
 * A GENERATOR (not a sensor): it copies the `example` vertical slice into a new
 * feature, renaming identifiers. It produces a compiling, tested
 * domain + application + infrastructure slice and the UI files, and appends the
 * needed `index.ts` exports. It deliberately does NOT edit the bespoke files
 * (each app's composition root, and the `AppUseCases` type) — those need
 * judgment, so they are returned as `nextSteps` for the agent/human to wire,
 * then verified with `pnpm harness quality`.
 *
 * v1 supports single-word, lowercase feature names (e.g. order, invoice, product).
 *
 * Usage: node scripts/harness/generators/generate-feature.mjs <name> [--root=<dir>]
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const name = args.find((a) => !a.startsWith('--'));

const emit = (obj, code) => {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
};

if (!name || !/^[a-z]+$/.test(name)) {
  emit(
    {
      tool: 'generate-feature',
      ok: false,
      error: `Invalid feature name "${name ?? ''}". v1 supports a single lowercase word (e.g. order, invoice, product).`,
    },
    1,
  );
}

const Pascal = name[0].toUpperCase() + name.slice(1);
const UPPER = name.toUpperCase();
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

/** Rename identifiers in file CONTENT (case-sensitive, longest/most-specific first). */
const transformContent = (s) =>
  s
    .replaceAll('ITEM', UPPER)
    .replaceAll('Item', Pascal)
    .replaceAll('item', name);
/** Rename the `item` token in a FILE NAME (lowercase only). */
const transformBasename = (b) => b.replaceAll('item', name);

// Slice sources → destinations. Example dirs are flat.
const dirJobs = [
  ['libs/domain/src/example', `libs/domain/src/${name}`],
  ['libs/application/src/example', `libs/application/src/${name}`],
  ['libs/ui/src/example', `libs/ui/src/${name}`],
];
const fileJobs = [
  [
    'libs/infrastructure/src/persistence/in-memory-item-repository.ts',
    `libs/infrastructure/src/persistence/in-memory-${name}-repository.ts`,
  ],
  [
    'libs/infrastructure/src/persistence/in-memory-item-repository.spec.ts',
    `libs/infrastructure/src/persistence/in-memory-${name}-repository.spec.ts`,
  ],
  [
    'libs/infrastructure/src/testing/item-repository-contract.ts',
    `libs/infrastructure/src/testing/${name}-repository-contract.ts`,
  ],
];

// Pre-flight: refuse to overwrite anything.
const conflicts = [];
for (const [, dest] of dirJobs)
  if (existsSync(path.join(ROOT, dest))) conflicts.push(dest);
for (const [, dest] of fileJobs)
  if (existsSync(path.join(ROOT, dest))) conflicts.push(dest);
if (conflicts.length) {
  emit(
    {
      tool: 'generate-feature',
      ok: false,
      error: 'Targets already exist',
      conflicts,
    },
    1,
  );
}

const created = [];
const copyFile = (srcAbs, destAbs) => {
  mkdirSync(path.dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, transformContent(readFileSync(srcAbs, 'utf8')));
  created.push(rel(destAbs));
};

for (const [srcDir, destDir] of dirJobs) {
  const srcAbs = path.join(ROOT, srcDir);
  for (const entry of readdirSync(srcAbs)) {
    const fileAbs = path.join(srcAbs, entry);
    if (statSync(fileAbs).isDirectory()) continue;
    copyFile(fileAbs, path.join(ROOT, destDir, transformBasename(entry)));
  }
}
for (const [src, dest] of fileJobs)
  copyFile(path.join(ROOT, src), path.join(ROOT, dest));

// Append the index.ts exports (append-only; safe because targets were new).
const appendExports = (indexRel, lines) => {
  const abs = path.join(ROOT, indexRel);
  const current = readFileSync(abs, 'utf8');
  const block = `\n// ${Pascal} feature (generated)\n${lines.join('\n')}\n`;
  writeFileSync(abs, current.replace(/\s*$/, '\n') + block);
  return indexRel;
};
const wired = [
  appendExports('libs/domain/src/index.ts', [`export * from './${name}';`]),
  appendExports('libs/application/src/index.ts', [
    `export * from './${name}/dto';`,
    `export * from './${name}/ports';`,
    `export * from './${name}/errors';`,
    `export * from './${name}/use-cases';`,
  ]),
  appendExports('libs/ui/src/index.ts', [
    `export * from './${name}/use-${name}s';`,
    `export * from './${name}/${name}-form';`,
    `export * from './${name}/${name}-screen';`,
  ]),
  appendExports('libs/infrastructure/src/index.ts', [
    `export * from './persistence/in-memory-${name}-repository';`,
  ]),
];

emit(
  {
    tool: 'generate-feature',
    generatedAt: new Date().toISOString(),
    ok: true,
    feature: { name, Pascal },
    created,
    wired,
    nextSteps: [
      `Extend AppUseCases in libs/ui/src/di/use-cases-context.tsx: import type { ${Pascal}UseCases } from '@acme/application' and add 'readonly ${name}s: ${Pascal}UseCases;'.`,
      `In each apps/*/src/composition-root.ts, build the use cases with make${Pascal}UseCases({ repository, clock, ids, events, logger }) and add '${name}s' to the returned useCases (mirror how 'items' is wired). Choose a repository adapter (e.g. createInMemory${Pascal}Repository for a quick start, or the Dexie/offline stack like items).`,
      `Replace the copied example logic with the real ${Pascal} domain rules, then run 'pnpm harness quality' (and 'pnpm harness gaps') to verify the slice is green.`,
    ],
    note: 'domain/application/infrastructure should compile and test on their own; the UI typecheck stays red until AppUseCases is extended (step 1).',
    scope:
      'This scaffolds a CRUD ENTITY feature (Item-shaped: an entity with a repository and create/rename/archive use cases). It is the wrong tool for cross-cutting concerns like authentication, sessions, or permissions — build those by hand following docs/ai/workflow.md (port type first), and run /security-review for sensitive ones.',
  },
  0,
);
