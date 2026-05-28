#!/usr/bin/env node
/**
 * Stage 4 — PostToolUse(Edit|Write|MultiEdit) hook.
 * Formats the touched file (prettier) and lints it (eslint). A lint failure —
 * including a layer-boundary violation — vetoes with exit 2 so the model gets
 * the error immediately and fixes it.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const cwd = payload.cwd || process.cwd();
const filePath = payload.tool_input?.file_path;
if (!filePath) process.exit(0);

const abs = path.resolve(cwd, filePath);
if (!existsSync(abs)) process.exit(0); // deleted / moved → nothing to check

const rel = path.relative(cwd, abs).split(path.sep).join('/');
const bin = (name) => path.join(cwd, 'node_modules', '.bin', name);

const FORMAT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html)$/;
const LINT_EXT = /\.(ts|tsx|js|jsx)$/;
const inSourceTree = rel.startsWith('libs/') || rel.startsWith('apps/');

// 1) Format (best-effort; never blocks on a formatting hiccup).
if (FORMAT_EXT.test(rel) && existsSync(bin('prettier'))) {
  spawnSync(bin('prettier'), ['--write', abs], { cwd, encoding: 'utf8' });
}

// 2) Lint the single file (boundary rules apply per-file). Blocks on failure.
if (inSourceTree && LINT_EXT.test(rel) && existsSync(bin('eslint'))) {
  const res = spawnSync(bin('eslint'), [abs], { cwd, encoding: 'utf8' });
  if (res.status && res.status !== 0) {
    const out = `${res.stdout || ''}${res.stderr || ''}`.trim().slice(0, 4000);
    process.stderr.write(
      `Lint failed for "${rel}" (this includes layer-boundary violations). ` +
        `Fix before continuing:\n\n${out}`,
    );
    process.exit(2);
  }
}

process.exit(0);
