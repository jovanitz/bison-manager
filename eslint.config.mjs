// @ts-check
import nx from '@nx/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the whole workspace.
 *
 * The heart of this file is `@nx/enforce-module-boundaries`, which turns the
 * architectural layering described in the ADRs into a build-time guarantee.
 * Every project is tagged in its `project.json` with exactly one `layer:*` tag.
 * The `depConstraints` below describe — declaratively — which layer may import
 * which. A violation fails `nx lint`, so the architecture cannot silently rot.
 *
 * On top of boundaries we enforce clean-code limits (small files, low
 * complexity) and SonarJS rules, scoped to app code (libs/apps). These keep
 * files human-readable and are the in-repo equivalent of a SonarQube pass.
 */

// Clean-code limits — see docs/ai/structure.md. Tuned so today's code passes.
const CLEAN_CODE_RULES = {
  'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
  // 70 (not 50): this codebase is built from factory functions that return an
  // object of methods, so a "function" legitimately bundles several small ones.
  // 70 still catches genuinely giant functions. File size is the headline cap.
  'max-lines-per-function': [
    'error',
    { max: 70, skipBlankLines: true, skipComments: true },
  ],
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
  'max-nested-callbacks': ['error', 3],
};

const APP_CODE = ['libs/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/node_modules'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // shared: foundational utilities, depends on nothing else.
            {
              sourceTag: 'layer:shared',
              onlyDependOnLibsWithTags: ['layer:shared'],
            },
            // domain: pure business model. May only use shared utilities.
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:shared'],
            },
            // application: orchestration. Depends only on domain (+ shared).
            {
              sourceTag: 'layer:application',
              onlyDependOnLibsWithTags: [
                'layer:application',
                'layer:domain',
                'layer:shared',
              ],
            },
            // infrastructure: implements application ports.
            {
              sourceTag: 'layer:infrastructure',
              onlyDependOnLibsWithTags: [
                'layer:infrastructure',
                'layer:application',
                'layer:domain',
                'layer:shared',
              ],
            },
            // platform: implements application ports for device capabilities.
            {
              sourceTag: 'layer:platform',
              onlyDependOnLibsWithTags: [
                'layer:platform',
                'layer:application',
                'layer:domain',
                'layer:shared',
              ],
            },
            // ui: consumes use cases. Never imports infrastructure or platform
            // directly — it receives them through the composition root.
            {
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: [
                'layer:ui',
                'layer:application',
                'layer:shared',
              ],
            },
            // apps: composition roots. May wire any layer together.
            {
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: false },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // Reinforce the "no classes / no OOP-heavy patterns" rule from the brief.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message:
            'Classes are banned by ADR-0002. Use factory functions and plain objects instead.',
        },
        {
          selector: 'Decorator',
          message: 'Decorators are banned by ADR-0002.',
        },
        {
          selector:
            'Literal[value=/\\b(gap(-[xy])?|space-[xy])-(2\\.5|3\\.5|4\\.5|5|7|9|11)\\b/]',
          message:
            'Off-scale spacing. Use the named rhythm (Stack: tight/cozy/field/group/section) or an on-scale gap (1.5/2/3/4/6/8). Half-steps like gap-2.5/gap-5 fragment the scale.',
        },
        {
          selector:
            'TemplateElement[value.raw=/\\b(gap(-[xy])?|space-[xy])-(2\\.5|3\\.5|4\\.5|5|7|9|11)\\b/]',
          message:
            'Off-scale spacing. Use the named rhythm (Stack: tight/cozy/field/group/section) or an on-scale gap (1.5/2/3/4/6/8). Half-steps like gap-2.5/gap-5 fragment the scale.',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // The domain layer gets the strictest possible isolation: no framework,
  // browser, or infrastructure imports may ever appear inside it.
  {
    files: ['libs/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Domain must not import React.' },
            { name: 'react-dom', message: 'Domain must not import React.' },
            { name: 'dexie', message: 'Domain must not import persistence.' },
            { name: 'zustand', message: 'Domain must not import state libs.' },
          ],
          patterns: [
            {
              group: ['@capacitor/*', '@tauri-apps/*'],
              message: 'Domain must not import platform SDKs.',
            },
            {
              group: ['@acme/infrastructure', '@acme/platform', '@acme/ui'],
              message: 'Domain must not import outer layers.',
            },
          ],
        },
      ],
    },
  },
  // Application is orchestration — framework-free like domain. No UI framework
  // and no state/reactivity lib; stores live in `ui`, controllers stay headless
  // so the UI and a future MCP server reuse them identically.
  {
    files: ['libs/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Application must stay framework-free (no React).' },
            { name: 'react-dom', message: 'Application must stay framework-free (no React).' },
            { name: 'zustand', message: 'Application must not import state libs — stores live in ui.' },
          ],
          patterns: [
            { group: ['zustand/*'], message: 'Application must not import state libs — stores live in ui.' },
            { group: ['@acme/infrastructure', '@acme/platform', '@acme/ui'], message: 'Application must not import outer layers.' },
          ],
        },
      ],
    },
  },
  // UI is store-mediated: feature/shell components read ViewModels + dispatch.
  // Only store builders (store/hooks.ts) may read the DI context. The auth-entry
  // leaf screens (login / activation) call a single auth use case, not flow
  // orchestration, so they are the explicit, reviewed exceptions.
  {
    files: ['libs/ui/src/client/**/*.{ts,tsx}', 'libs/ui/src/dashboard/**/*.{ts,tsx}'],
    ignores: [
      '**/store/**',
      '**/*.spec.{ts,tsx}', // tests wire UseCasesProvider with mocks
      '**/*login-screen*',
      '**/*activate-invitation-screen*',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/di/use-cases-context'],
              message:
                'Components are store-mediated: read ViewModels + dispatch. Wire stores from useUseCases only in store/hooks.ts.',
            },
          ],
        },
      ],
    },
  },
  // ── Clean code (Sonar-like), scoped to app code. Harness scripts (.mjs) and
  // config files are intentionally exempt.
  { files: APP_CODE, rules: CLEAN_CODE_RULES },
  { ...sonarjs.configs.recommended, files: APP_CODE },
  {
    files: APP_CODE,
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
      // `void promise` is our deliberate marker for intentional fire-and-forget.
      'sonarjs/void-use': 'off',
      // Semantic primitive aliases (e.g. `type Millis = number`) aid readability.
      'sonarjs/redundant-type-aliases': 'off',
    },
  },
  // Composition roots are assembly: wiring many adapters in one factory is their
  // job, so the function-length cap doesn't apply.
  {
    files: ['apps/**/composition-root.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  // Fake/test-double adapters are setup-heavy by nature.
  {
    files: ['**/fake/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  // Tests & contracts: relax size/duplication — fixtures and repetitive
  // assertions are expected and not a smell there.
  {
    files: [
      '**/*.spec.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/testing/**/*.ts',
      '**/*.bench.ts',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-functions': 'off',
      // Contract-test specs call a shared contract fn, so they look "empty".
      'sonarjs/no-empty-test-file': 'off',
    },
  },
  prettier,
];
