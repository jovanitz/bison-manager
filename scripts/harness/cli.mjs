#!/usr/bin/env node
/**
 * Harness CLI — this project's thin shim over the portable @harness/core engine.
 *
 * The engine (tools/harness/src) is project-agnostic; this shim feeds it THIS
 * repo's manifest (the tool list) + the directory the tool scripts live in.
 * The manifest (manifest.mjs) is the single source of truth; see docs/ai/harness.md.
 *
 *   pnpm harness                  Print the grouped tool tree.
 *   pnpm harness <group>          Run every tool in a group (check|analyze|…).
 *   pnpm harness check            The blocking gate set (matches the Stop hook).
 *   pnpm harness <tool> [args…]   Run one tool (args passed through).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runHarnessCli } from '../../tools/harness/src/index.mjs';
import { GROUPS, TOOLS } from './manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

process.exit(
  runHarnessCli({
    scriptsDir: here,
    groups: GROUPS,
    tools: TOOLS,
    argv: process.argv.slice(2),
  }),
);
