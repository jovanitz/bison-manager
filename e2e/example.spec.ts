import { test, expect } from '@playwright/test';

/**
 * Verifies the example feature the way a user experiences it, then introspects
 * the runtime state through the debug bridge. Copy this shape for real features
 * (e.g. an auth flow: sign in, then assert window.__app__ shows the session).
 */
test('item screen renders and exposes runtime state', async ({ page }) => {
  await page.goto('/');

  // As a user: the screen renders.
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();

  // As a developer: read the internal runtime state via the bridge.
  const snapshot = await page.evaluate(() => {
    const w = window as unknown as {
      __app__?: {
        snapshot: () => { useCases: string[]; errors: unknown[] };
      };
    };
    return w.__app__?.snapshot() ?? null;
  });

  expect(snapshot, 'debug bridge should be installed in dev').not.toBeNull();
  expect(snapshot?.useCases).toContain('items');
  expect(snapshot?.errors).toEqual([]); // no runtime errors on load
});
