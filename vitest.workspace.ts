/**
 * Vitest workspace: lets `vitest run` from the repo root execute every project's
 * suite with its own environment (node / happy-dom / jsdom). Nx also runs each
 * project's `test` target individually via the @nx/vite plugin.
 */
export default [
  'libs/shared/vitest.config.ts',
  'libs/domain/vitest.config.ts',
  'libs/application/vitest.config.ts',
  'libs/infrastructure/vitest.config.ts',
  'libs/platform/vitest.config.ts',
  'libs/ui/vitest.config.ts',
];
