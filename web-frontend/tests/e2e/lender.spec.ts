import { expect, test } from '@playwright/test';

import { inviteLender, randomEmail, staticOtp } from './support/backend';

test('an invited lender user signs in with an email code and opens the submissions inbox', async ({ page }) => {
  const email = randomEmail('e2e.lender');
  const organisation = await inviteLender(email);

  await page.goto('/login');
  await page.getByRole('button', { name: 'Login As' }).click();
  await page.getByRole('button', { name: /^Lender/ }).click();
  await expect(page.getByLabel('Email Address')).toBeVisible();
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/Sent To/)).toBeVisible();
  await page.getByLabel('One-Time Code').fill(staticOtp());

  await expect(page).toHaveURL(/\/lender$/);
  await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open Menu' });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByText(organisation).locator('visible=true').first()).toBeVisible();
});
