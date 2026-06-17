/**
 * Harness configuration for THIS project — the per-repo values the (portable)
 * harness reads. When the harness becomes a standalone package, this is the one
 * file an adopting project writes; the engine + sensors stay project-agnostic.
 *
 * Today it is consumed in-place by the sensors/hooks under scripts/harness/.
 */
export default {
  /** Files an agent must not edit directly (the pre-edit + git guards read this). */
  protectedFiles: [
    'eslint.config.mjs',
    'docs/ai/capabilities.json',
    'nx.json',
    'tsconfig.base.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.claude/settings.json',
  ],

  /** File/folder organization limits (the `structure` sensor). */
  structure: {
    maxFilesPerDir: 8,
    maxFileLoc: 250,
  },

  /** Path prefixes that count as source (the post-edit hook lints these). */
  sourceRoots: ['libs/', 'apps/'],

  /**
   * `purity` sensor — layers that MUST be side-effect-free & deterministic
   * (no DOM/storage/network/console/timers, no wall-clock or RNG). Catches
   * impurity the import-ban can't (it's a call, not an import). Test doubles,
   * formal helpers and specs/benches are excluded.
   */
  purity: {
    layers: ['libs/domain/src', 'libs/application/src'],
    exclude: [
      '**/*.spec.*',
      '**/*.bench.*',
      '**/testing.ts',
      '**/testing/**',
      '**/_formal/**',
    ],
  },

  /**
   * Project-specific `doctor` check: capabilities.json (the layer-import doc)
   * must stay in sync with ESLint's enforce-module-boundaries. Omit (set null)
   * in a project that doesn't use layer-tagged boundaries — `doctor` skips it.
   */
  capabilitiesCheck: {
    capabilities: 'docs/ai/capabilities.json',
    eslint: 'eslint.config.mjs',
  },

  /**
   * Folder/file conventions the `gaps` (TDD) sensor uses to detect untested
   * code. Each pattern is a RegExp source string. An adopting project with a
   * different layout overrides these; the defaults below match this repo.
   *   adapterDir   — path of adapters whose `create*` factory must be exercised
   *   useCaseFile  — a use-case file that must have a headless spec
   *   screenFile   — a screen that must have a component test
   *   domainLayer  — the layer whose exported logic must have a unit spec
   */
  conventions: {
    adapterDir:
      '\\/(?:infrastructure\\/src\\/(?:api|persistence|sync|auth)|platform\\/src\\/(?:browser|capacitor|tauri))\\/',
    useCaseFile: 'use-cases?\\.ts$',
    screenFile: '-screen\\.tsx$',
    domainLayer: 'domain',
  },

  /** SessionStart orientation lines (joined and injected as context). */
  orientation: [
    'Acme AI harness active.',
    'Architecture: Clean + Hexagonal, Nx monorepo. Dependencies point inward.',
    'Layer import rules (authoritative): docs/ai/capabilities.json.',
    'Build features inside-out: port TYPE first → use-case spec (in-memory adapters) → adapter contract test → screen test → wire in apps/*/composition-root.ts.',
    'Hard rules: no classes/decorators; return Result, never throw; domain/application import no framework/browser/DB/HTTP/auth/native/state-libs.',
    'Inside a screen the flow is one-way: UI → Store → Controller → Use case → Domain. Components read ViewModels + dispatch; cross-module orchestration lives in headless flows (libs/application/src/flows), never in a component or store. Read docs/ai/flows.md before touching a screen.',
    'Auth/access model (identity≠authorization, actor resolution, presets/scopes, multi-org, grants, invitations, soft-block vs hard-disable, root protection): read docs/ai/auth.md before touching anything auth-related.',
    'Before finishing, the Stop hook runs lint+typecheck+test on affected projects — keep it green.',
  ],
};
