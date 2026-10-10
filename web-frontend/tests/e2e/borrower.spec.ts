import { expect, test } from '@playwright/test';

import { randomMobile } from './support/backend';
import { signInWithOtp } from './support/sign-in';

test('a borrower signs in, starts an application and manages their account', async ({ page }) => {
  await signInWithOtp(page, randomMobile());
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Your applications' })).toBeVisible();

  await page.getByRole('link', { name: 'New application' }).first().click();
  await expect(page.getByRole('heading', { name: 'New application' })).toBeVisible();
  await page.getByRole('button', { name: /Business \/ MSME/ }).click();
  await page.getByRole('button', { name: 'Proprietor', exact: true }).click();
  const category = page.locator('button[aria-pressed]:not([disabled])').filter({ hasText: /₹/ }).first();
  await category.click();
  await page.getByRole('button', { name: 'Create application' }).click();
  await expect(page).toHaveURL(/\/app\/applications\/[0-9a-f-]+$/);
  await expect(page.getByText('Your progress')).toBeVisible();
  await expect(page.getByText('Current step')).toBeVisible();

  await page.goto('/account');
  await page.getByLabel('Full name').fill('Asha Verma');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();

  await page.goto('/account/notifications');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Update channels saved')).toBeVisible();

  await page.goto('/account/security');
  await expect(page.getByText('This device')).toBeVisible();

  await page.goto('/account/privacy');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/Request DR-\d{2}-\d+ received/)).toBeVisible();
});

test('protected pages send visitors to sign in', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
  await page.goto('/ops/leads');
  await expect(page).toHaveURL(/\/staff\/login\?next=%2Fops%2Fleads/);
});
