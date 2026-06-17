/**
 * The single source of truth for the harness tool catalog.
 *
 * Every tool the harness exposes is declared ONCE here. The grouped CLI, the
 * Stop-hook gate, `doctor`, docs and (later) the MCP tool namespaces all DERIVE
 * from this list instead of each keeping its own copy. Adding a tool = one entry.
 *
 *   name      CLI command + (future) MCP leaf, e.g. `cycles` → MCP `check.cycles`
 *   group     one of GROUPS; the CLI/MCP namespace it lives in
 *   kind      'static'  → runs offline against the repo
 *             'runtime' → needs the running app (Playwright / Runtime Inspector)
 *   blocking  true → part of the "is it green to finish?" gate (`harness check`)
 *   summary   one line; reused by `harness` (tree) and the MCP tool description
 *   script    path under scripts/harness/ — the CLI shells out to it
 *   gateArgs  args used when run as part of `harness check` (e.g. quality --build)
 *   write     true if it MUTATES the repo (generator / --write mode)
 */

/** Group metadata — order here is the order the tree prints. */
export const GROUPS = {
  check:
    'Fast correctness gates — "is it green to finish?" (the Stop-hook set)',
  analyze: 'Understand a change — blast radius, coverage, perf (non-blocking)',
  secure: 'Supply chain + agent-surface security',
  inspect: 'Live app — e2e today, Runtime Inspector (stores/invariants) next',
  meta: 'Harness self-care — self-check + code generators',
};

/**
 * @typedef {{ name: string, group: keyof typeof GROUPS, kind: 'static'|'runtime',
 *   blocking: boolean, summary: string, script: string,
 *   gateArgs?: string[], write?: boolean }} Tool
 * @type {Tool[]}
 */
export const TOOLS = [
  // ── check: the Stop-hook gate ─────────────────────────────────────────────
  {
    name: 'quality',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary: 'Lint + typecheck + test on affected projects',
    script: 'sensors/quality.mjs',
    gateArgs: ['--build'],
  },
  {
    name: 'structure',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary: 'File/folder organization: files-per-folder, oversized files',
    script: 'sensors/structure.mjs',
  },
  {
    name: 'cycles',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary: 'Circular import dependencies (file level, madge)',
    script: 'sensors/cycles.mjs',
  },
  {
    name: 'gaps',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary:
      'Untested adapters/use-cases/screens/domain logic, TODOs (TDD gate)',
    script: 'sensors/gaps.mjs',
  },
  {
    name: 'rules',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary: 'Business-rules doc in sync with the code (--write regenerates)',
    script: 'sensors/rules.mjs',
  },
  {
    name: 'formal',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary: 'Property-based tests + BFS model-checks of the pure core',
    script: 'sensors/formal.mjs',
  },
  {
    name: 'purity',
    group: 'check',
    kind: 'static',
    blocking: true,
    summary:
      'Pure layers free of side effects / non-determinism (calls, not imports)',
    script: 'sensors/purity.mjs',
  },
  // ── analyze: understand a change (non-blocking) ───────────────────────────
  {
    name: 'impact',
    group: 'analyze',
    kind: 'static',
    blocking: false,
    summary: 'Blast radius of a change (affected projects, platforms, risk)',
    script: 'sensors/impact.mjs',
  },
  {
    name: 'consumers',
    group: 'analyze',
    kind: 'static',
    blocking: false,
    summary: 'File-level blast radius: who imports the changed/named files',
    script: 'sensors/consumers.mjs',
  },
  {
    name: 'dead-code',
    group: 'analyze',
    kind: 'static',
    blocking: false,
    summary: 'Unused files / exports / types (knip)',
    script: 'sensors/dead-code.mjs',
  },
  {
    name: 'coverage',
    group: 'analyze',
    kind: 'static',
    blocking: false,
    summary: 'Per-layer line-coverage floor on the pure core (CI gate)',
    script: 'sensors/coverage.mjs',
  },
  {
    name: 'perf',
    group: 'analyze',
    kind: 'static',
    blocking: false,
    summary: 'Bundle size (raw+gzip) + benchmarks of the pure core',
    script: 'sensors/perf.mjs',
  },
  // ── secure ────────────────────────────────────────────────────────────────
  {
    name: 'audit',
    group: 'secure',
    kind: 'static',
    blocking: false,
    summary: 'Dependency CVE scan (pnpm audit / OSV)',
    script: 'sensors/audit.mjs',
  },
  {
    name: 'skill-scan',
    group: 'secure',
    kind: 'static',
    blocking: false,
    summary: 'Agent-surface security scan of skills/MCP (NVIDIA SkillSpector)',
    script: 'sensors/skill-scan.mjs',
  },
  // ── inspect: live app ─────────────────────────────────────────────────────
  {
    name: 'e2e',
    group: 'inspect',
    kind: 'runtime',
    blocking: false,
    summary: 'Browser-level verification (Playwright) + runtime bridge',
    script: 'sensors/e2e.mjs',
  },
  // ── meta: self-care + generators ──────────────────────────────────────────
  {
    name: 'doctor',
    group: 'meta',
    kind: 'static',
    blocking: false,
    summary: 'Self-check the harness (hooks, scripts, capabilities↔eslint)',
    script: 'sensors/doctor.mjs',
  },
  {
    name: 'generate-feature',
    group: 'meta',
    kind: 'static',
    blocking: false,
    write: true,
    summary: 'Generator: copy the example slice into a new feature',
    script: 'generators/generate-feature.mjs',
  },
];

export const toolByName = (name) => TOOLS.find((t) => t.name === name);
export const toolsInGroup = (group) => TOOLS.filter((t) => t.group === group);
export const blockingTools = () => TOOLS.filter((t) => t.blocking);
