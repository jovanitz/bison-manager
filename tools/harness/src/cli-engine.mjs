/**
 * @harness/core — the project-agnostic grouped CLI engine.
 *
 * It knows nothing about a specific repo: a consumer calls `runHarnessCli` with
 * its own `groups` + `tools` (the manifest) and the directory the tool scripts
 * live in. The engine resolves groups/tools, prints the grouped tree, runs a
 * group or the blocking `check` set, or a single tool with passthrough args.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const flag = (t) =>
  [
    t.blocking ? 'gate' : null,
    t.kind === 'runtime' ? 'runtime' : null,
    t.write ? 'writes' : null,
  ]
    .filter(Boolean)
    .join(',');

const printTree = (groups, tools, out) => {
  out('harness <command> [options]\n\n');
  for (const [group, blurb] of Object.entries(groups)) {
    out(`${group} — ${blurb}\n`);
    for (const t of tools.filter((x) => x.group === group)) {
      const f = flag(t);
      out(`  ${t.name.padEnd(18)} ${t.summary}${f ? `  [${f}]` : ''}\n`);
    }
    out('\n');
  }
  out(
    'Run a group (e.g. `harness check`) or a single tool (e.g. `harness gaps --layer=domain`).\n',
  );
};

const runTool = (scriptsDir, tool, args) =>
  spawnSync(process.execPath, [path.join(scriptsDir, tool.script), ...args], {
    stdio: 'inherit',
  }).status ?? 1;

const runMany = (scriptsDir, tools, label, out) => {
  const results = tools.map((t) => ({
    name: t.name,
    code: runTool(scriptsDir, t, t.gateArgs ?? []),
  }));
  const failed = results.filter((r) => r.code !== 0);
  out(
    `\n${label}: ${results.length - failed.length}/${results.length} ok` +
      (failed.length
        ? ` — failed: ${failed.map((r) => r.name).join(', ')}\n`
        : '\n'),
  );
  return failed.length === 0 ? 0 : 1;
};

/**
 * @param {{ scriptsDir: string, groups: Record<string,string>,
 *   tools: Array<object>, argv: string[],
 *   out?: (s:string)=>void, err?: (s:string)=>void }} opts
 * @returns {number} process exit code
 */
export const runHarnessCli = ({
  scriptsDir,
  groups,
  tools,
  argv,
  out = (s) => process.stdout.write(s),
  err = (s) => process.stderr.write(s),
}) => {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printTree(groups, tools, out);
    return cmd ? 0 : 1;
  }

  // A group → run it. `check` = the blocking gate set across all groups.
  if (cmd === 'check') {
    return runMany(
      scriptsDir,
      tools.filter((t) => t.blocking),
      'check',
      out,
    );
  }
  if (Object.prototype.hasOwnProperty.call(groups, cmd)) {
    // Generators (write) are never auto-run as part of a group — explicit only.
    return runMany(
      scriptsDir,
      tools.filter((t) => t.group === cmd && !t.write),
      cmd,
      out,
    );
  }

  // A single tool → run it with passthrough args (back-compat).
  const tool = tools.find((t) => t.name === cmd);
  if (!tool) {
    err(`Unknown command: ${cmd}\n\n`);
    printTree(groups, tools, out);
    return 1;
  }
  return runTool(scriptsDir, tool, rest);
};
