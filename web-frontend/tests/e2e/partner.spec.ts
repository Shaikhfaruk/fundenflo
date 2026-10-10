import { expect, test } from '@playwright/test';

import { randomMobile } from './support/backend';
import { signInWithOtp } from './support/sign-in';

test('a chartered accountant registers a firm and waits for verification', async ({ page }) => {
  await signInWithOtp(page, randomMobile(), 'Chartered accountant');
  await expect(page).toHaveURL(/\/partner\/signup$/);
  await page.getByLabel('Firm name').fill(`Verma & Co ${Date.now()}`);
  await page.getByLabel('ICAI membership number').fill('512345');
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByText('Registration received')).toBeVisible();
  await page.getByRole('link', { name: 'See your roles' }).click();
  await expect(page.getByText('Pending')).toBeVisible();
});
