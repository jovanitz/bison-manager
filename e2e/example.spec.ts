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

/**
 * A REAL user flow (not just a render): create then archive an item, driving the
 * whole stack the simulated tests fake — the real composition root
 * (`createWebRuntime`), the real Dexie/IndexedDB persistence behind the offline
 * repository, the real router, and the runtime bridge. This is exactly the kind
 * of gap the `runtime-advice` sensor flags (a faked seam: composition root + a
 * real adapter), so it earns an e2e.
 */
test('creates then archives an item, reflected in the runtime bridge', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();

  // Each test gets a fresh browser context → IndexedDB starts empty.
  await expect(page.getByText('No items yet. Add one above.')).toBeVisible();

  // As a user: create via the real form → real Dexie write → the list refetches.
  const name = `E2E item ${Date.now()}`;
  await page.getByLabel('Item name').fill(name);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText(name)).toBeVisible();

  // As a user: archive it → the offline repository drops it from the active list.
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText(name)).toBeHidden();
  await expect(page.getByText('No items yet. Add one above.')).toBeVisible();

  // As a developer: the bridge confirms the `items` use case is wired and the
  // create/archive ran clean. Sync only fires on an online/offline transition
  // (browser-platform `subscribe` doesn't emit on load), so the outbox stays
  // quiet here and `errors` stays empty — no flake from the (absent) API.
  const snapshot = await page.evaluate(() => {
    const w = window as unknown as {
      __app__?: { snapshot: () => { useCases: string[]; errors: unknown[] } };
    };
    return w.__app__?.snapshot() ?? null;
  });
  expect(snapshot, 'debug bridge should be installed in dev').not.toBeNull();
  expect(snapshot?.useCases).toContain('items');
  expect(snapshot?.errors).toEqual([]);
});
