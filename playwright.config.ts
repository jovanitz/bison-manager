import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-level verification (E2E). Drives the app as a user AND reads the
 * dev-only runtime introspection bridge (window.__app__) via page.evaluate, so a
 * test can assert on internal state, not just the DOM. Exposed as the `e2e`
 * harness sensor; on-demand (heavy), not part of the Stop gate.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm web',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
