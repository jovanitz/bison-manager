// @ts-check
import nx from '@nx/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the whole workspace.
 *
 * The heart of this file is `@nx/enforce-module-boundaries`, which turns the
 * architectural layering described in the ADRs into a build-time guarantee.
 * Every project is tagged in its `project.json` with exactly one `layer:*` tag.
 * The `depConstraints` below describe — declaratively — which layer may import
 * which. A violation fails `nx lint`, so the architecture cannot silently rot.
 */
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
  prettier,
];
