import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD } from './fixtures';

/**
 * Staff dashboard (port 4201), against the REAL backend. `RequireAdmin` shows a
 * login gate until an authorized platform admin is present; owner@local.dev is
 * the bootstrap owner (all permissions), so it passes the gate and the directory
 * tables load — driven through the real Supabase token + API actor resolution.
 */
test('staff signs in and sees the directory dashboard', async ({ page }) => {
  await page.goto('http://localhost:4201/');
  await expect(
    page.getByRole('heading', { name: 'Staff sign in' }),
  ).toBeVisible();

  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Past the admin gate → the real directory screen.
  await expect(
    page.getByRole('heading', { name: 'Staff dashboard' }),
  ).toBeVisible();

  const snapshot = await page.evaluate(() => {
    const w = window as unknown as {
      __app__?: { snapshot: () => { useCases: string[] } };
    };
    return w.__app__?.snapshot() ?? null;
  });
  expect(snapshot, 'debug bridge should be installed in dev').not.toBeNull();
});
