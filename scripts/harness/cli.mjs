#!/usr/bin/env node
/**
 * Harness CLI — single entry point for the harness SENSORS.
 * Each subcommand prints JSON to stdout so the model (or CI) can parse it.
 * The sensor logic lives once in scripts/harness/sensors/; this is just a
 * surface over it (so are the hooks and skills). See docs/ai/harness.md.
 *
 *   pnpm harness gaps [--layer=<name>]   Find development gaps (untested
 *                                        adapters/use-cases/screens, TODOs).
 *   pnpm harness impact [--base --head] Blast radius of a change (affected
 *                                        projects, platforms, risk hint).
 *   pnpm harness perf [--app --skip-build] Bundle size (raw+gzip) + benchmarks
 *                                        of the pure core.
 *   pnpm harness quality [--all]        Quality gate: lint+typecheck+test
 *                                        (affected, or all with --all).
 *   pnpm harness generate-feature <name> Generator: copy the example slice into
 *                                        a new feature (then wire + verify).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

const COMMANDS = {
  // Sensors (feedback controls — observe, return JSON)
  gaps: 'sensors/gaps.mjs',
  impact: 'sensors/impact.mjs',
  perf: 'sensors/perf.mjs',
  quality: 'sensors/quality.mjs',
  structure: 'sensors/structure.mjs',
  doctor: 'sensors/doctor.mjs',
  // Generators (write code — not controls)
  'generate-feature': 'generators/generate-feature.mjs',
};

function help() {
  process.stdout.write(
    'harness <command> [options]\n\n' +
      'Sensors (observe → JSON):\n' +
      '  gaps      Find development gaps (untested adapters/use-cases/screens, TODOs)\n' +
      '  impact    Blast radius of a change (affected projects, platforms, risk)\n' +
      '  perf      Bundle size (raw+gzip) + benchmarks of the pure core\n' +
      '  quality   Quality gate: lint + typecheck + test (--build, --all)\n' +
      '  structure Folder/file organization (files-per-folder, oversized files)\n' +
      '  doctor    Self-check the harness (hooks, scripts, capabilities↔eslint)\n\n' +
      'Generators (write code):\n' +
      '  generate-feature <name>   Copy the example slice into a new feature\n',
  );
}

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(cmd ? 0 : 1);
}

const script = COMMANDS[cmd];
if (!script) {
  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  help();
  process.exit(1);
}

const res = spawnSync(process.execPath, [path.join(here, script), ...rest], {
  stdio: 'inherit',
});
process.exit(res.status ?? 1);
