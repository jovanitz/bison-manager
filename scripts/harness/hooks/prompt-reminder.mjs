#!/usr/bin/env node
/**
 * Stage 1 — UserPromptSubmit hook.
 * Injects a concise reminder of the non-negotiables. Non-blocking.
 */
import { readFileSync } from 'node:fs';

try {
  readFileSync(0, 'utf8');
} catch {
  /* no stdin is fine */
}

const reminder = [
  'Harness reminder:',
  'respect layer boundaries (docs/ai/capabilities.json — e.g. ui must not import infrastructure/platform; domain & application import no framework, browser, DB, HTTP, auth or native).',
  'Return Result, never throw, for expected failures.',
  'For a new capability, add a port TYPE in application before any adapter.',
  'Run the quality gate before declaring the work done.',
].join(' ');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: reminder,
    },
  }),
);
process.exit(0);
