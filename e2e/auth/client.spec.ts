import { test, expect } from '@playwright/test';
import { OWNER_PASSWORD } from './fixtures';

/**
 * Customer onboarding (port 4202), against the REAL backend. A brand-new identity
 * has no organization yet, so the client app's session gate walks them through
 * sign-up → "create your organization" → home. This exercises the full customer
 * onboarding seam (Supabase sign-up + the API's createOrganization), which only
 * the running stack can prove. A fresh email per run keeps it idempotent.
 */
test('a new customer signs up, creates an org, and lands on home', async ({
  page,
}) => {
  await page.goto('http://localhost:4202/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  const email = `customer-${Date.now()}@local.dev`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // No org yet → the onboarding form.
  await expect(
    page.getByRole('heading', { name: 'Create your organization' }),
  ).toBeVisible();
  await page.getByLabel('Organization name').fill('Acme QA Org');
  await page.getByRole('button', { name: 'Create organization' }).click();

  // Onboarded → the client home screen for the new org.
  await expect(page.getByRole('heading', { name: 'My account' })).toBeVisible();
});
