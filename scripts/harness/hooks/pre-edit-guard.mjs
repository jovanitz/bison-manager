#!/usr/bin/env node
/**
 * Stage 3 — PreToolUse(Edit|Write|MultiEdit) hook.
 * Blocks edits to protected harness/config files. Strict: exit 2 vetoes the
 * tool call and feeds the reason back to the model.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared with the git pre-commit hook — one source of truth for protected files.
const { isProtected } = await import(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'protected-files.mjs',
  )
);

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // can't parse → don't block
}

const cwd = payload.cwd || process.cwd();
const filePath = payload.tool_input?.file_path;
if (!filePath) process.exit(0);

const rel = path
  .relative(cwd, path.resolve(cwd, filePath))
  .split(path.sep)
  .join('/');

if (isProtected(rel)) {
  process.stderr.write(
    `Blocked by harness: "${rel}" is a protected config file (it defines the ` +
      `architecture rules — layer tags / boundaries — the harness enforces). Do ` +
      `not edit it directly — ask the user to confirm this change first, then it ` +
      `can be made manually.`,
  );
  process.exit(2);
}

process.exit(0);
