import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD } from './fixtures';

/**
 * The highest-value e2e: the live frontend↔backend AUTH seam. Sign in through the
 * real web app → a real Supabase token → the API verifies it (JWKS) and resolves
 * the actor → the screen renders the bootstrapped owner's permissions.
 *
 * Nothing below e2e exercises this seam: the API is tested in-memory and the UI
 * is tested against mock use cases — the two real processes never meet. This is
 * the canonical "e2e-only" case from docs/ai/methodology.md ("When does e2e earn
 * its cost?"). Requires the backend booted by global-setup (Supabase + API).
 */
test('signs in against the real backend and shows the bootstrapped owner access', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // As a user: real credentials → real Supabase auth → real API actor resolution.
  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The access snapshot panel renders the actor the API resolved over the wire.
  await expect(page.getByRole('heading', { name: 'Signed in' })).toBeVisible();
  // owner@local.dev is BOOTSTRAP_OWNER_EMAIL → owner permissions come back.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'permissions.update' }),
  ).toBeVisible();

  // As a developer: the bridge confirms the access use cases are wired live.
  const snapshot = await page.evaluate(() => {
    const w = window as unknown as {
      __app__?: { snapshot: () => { useCases: string[] } };
    };
    return w.__app__?.snapshot() ?? null;
  });
  expect(snapshot, 'debug bridge should be installed in dev').not.toBeNull();
  expect(snapshot?.useCases).toContain('access');
});
