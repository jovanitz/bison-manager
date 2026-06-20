import { defineConfig, devices } from '@playwright/test';

/**
 * Auth (front↔back) e2e — the ONLY suite that drives the real backend: it boots
 * local Supabase (global-setup), the API and the web app, then signs in for real.
 *
 * It is a SEPARATE config from the default web-only one (playwright.config.ts) on
 * purpose: this suite is heavy and Docker-dependent, and the cheap web e2e must
 * not pay for that. Exposed as the `e2e-auth` harness sensor; on-demand, never in
 * the gate. Run: `pnpm harness e2e-auth`.
 */
export default defineConfig({
  testDir: './e2e/auth',
  globalSetup: './e2e/auth/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'line' : 'list',
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm api',
      url: 'http://localhost:3333/dev',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      // The API allows browser origins per CORS; its dev default is the web app
      // (:4200) only. The dashboard (:4201) and client (:4202) are cross-origin,
      // so allow all three here — otherwise their real fetches are CORS-blocked.
      env: {
        CORS_ORIGINS:
          'http://localhost:4200,http://localhost:4201,http://localhost:4202',
      },
    },
    {
      command: 'pnpm web',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'pnpm exec nx serve dashboard',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'pnpm exec nx serve client',
      url: 'http://localhost:4202',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
