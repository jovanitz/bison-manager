#!/usr/bin/env node
/**
 * Stage 4 — PostToolUse(Edit|Write|MultiEdit) hook (project shim).
 * Formats + lints the touched file via @harness/core; a lint failure (incl. a
 * layer-boundary violation) vetoes with exit 2 so the model fixes it at once.
 */
import { readFileSync } from 'node:fs';
import harnessConfig from '../../../harness.config.mjs';
import { runPostEdit } from '../../../tools/harness/src/hooks/post-edit.mjs';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const cwd = payload.cwd || process.cwd();
const filePath = payload.tool_input?.file_path;
if (!filePath) process.exit(0);

const result = runPostEdit({
  cwd,
  filePath,
  sourceRoots: harnessConfig.sourceRoots,
});
if (result.blocked) {
  process.stderr.write(result.message);
  process.exit(2);
}
process.exit(0);
