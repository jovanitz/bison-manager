/**
 * @harness/core — public entry. The portable engine a consuming repo drives
 * with its own manifest + harness.config. More engines (sensors, hook runners)
 * migrate here incrementally; the dispatcher is the first extracted piece.
 */
export { runHarnessCli } from './cli-engine.mjs';
