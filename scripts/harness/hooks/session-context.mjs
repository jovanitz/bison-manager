#!/usr/bin/env node
/**
 * Stage 0 — SessionStart hook (project shim).
 * Injects this repo's orientation (from harness.config) via @harness/core.
 */
import { readFileSync } from 'node:fs';
import harnessConfig from '../../../harness.config.mjs';
import { buildSessionContext } from '../../../tools/harness/src/hooks/session-context.mjs';

try {
  readFileSync(0, 'utf8'); // drain stdin (hook payload), unused here
} catch {
  /* no stdin is fine */
}

process.stdout.write(
  JSON.stringify(buildSessionContext(harnessConfig.orientation)),
);
process.exit(0);
