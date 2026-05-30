#!/usr/bin/env node
/**
 * Harness sensor — `structure`.
 *
 * Enforces the things ESLint can't express but humans care about:
 *  - no folder with too many files (push toward feature subfolders / screaming
 *    architecture instead of dumping everything in one directory),
 *  - no oversized file (a backstop above ESLint's max-lines).
 * Also reports the largest files for visibility. Prints JSON; exit 1 on any
 * high-severity violation (so the Stop guardrail can block on it).
 *
 * Usage: node scripts/harness/sensors/structure.mjs [--root=<dir>]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const MAX_FILES_PER_DIR = 8; // avoid "dozens of files in one folder"
const MAX_FILE_LOC = 250; // raw-line backstop above ESLint's max-lines (200)

const args = process.argv.slice(2);
const getArg = (n) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const ROOT = path.resolve(getArg('root') || process.cwd());
const SCAN = ['libs', 'apps'].map((d) => path.join(ROOT, d));
const IGNORE = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const CODE = /\.(ts|tsx)$/;
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// Collect code files grouped by their directory.
const filesByDir = new Map();
const allFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (CODE.test(entry)) {
      allFiles.push(full);
      const d = path.dirname(full);
      filesByDir.set(d, (filesByDir.get(d) ?? 0) + 1);
    }
  }
};
SCAN.forEach(walk);

const violations = [];

// 1) Folders with too many files.
for (const [dir, count] of filesByDir) {
  if (count > MAX_FILES_PER_DIR) {
    violations.push({
      type: 'folder-overflow',
      severity: 'high',
      path: rel(dir),
      detail: `${count} files (max ${MAX_FILES_PER_DIR}). Split into feature/concern subfolders.`,
    });
  }
}

// 2) Oversized files + largest-files overview.
const withLoc = allFiles.map((f) => ({
  file: rel(f),
  loc: readFileSync(f, 'utf8').split('\n').length,
}));
for (const { file, loc } of withLoc) {
  if (loc > MAX_FILE_LOC) {
    violations.push({
      type: 'large-file',
      severity: 'high',
      path: file,
      detail: `${loc} lines (max ${MAX_FILE_LOC}). Break it into smaller modules.`,
    });
  }
}
const largest = withLoc.sort((a, b) => b.loc - a.loc).slice(0, 5);

const high = violations.filter((v) => v.severity === 'high').length;
process.stdout.write(
  JSON.stringify(
    {
      tool: 'structure',
      generatedAt: new Date().toISOString(),
      ok: high === 0,
      thresholds: {
        maxFilesPerDir: MAX_FILES_PER_DIR,
        maxFileLoc: MAX_FILE_LOC,
      },
      summary: {
        files: allFiles.length,
        folders: filesByDir.size,
        violations: violations.length,
      },
      violations,
      largest,
    },
    null,
    2,
  ) + '\n',
);
process.exit(high ? 1 : 0);
