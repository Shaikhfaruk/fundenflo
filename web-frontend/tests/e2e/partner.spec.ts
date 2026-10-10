import { expect, test } from '@playwright/test';

import { randomMobile } from './support/backend';
import { signInWithOtp } from './support/sign-in';

test('a chartered accountant registers a firm and waits for verification', async ({ page }) => {
  await signInWithOtp(page, randomMobile(), 'Chartered Accountant');
  await expect(page).toHaveURL(/\/partner\/signup$/);
  await page.getByLabel('Firm Name').fill(`Verma & Co ${Date.now()}`);
  await page.getByLabel('ICAI Membership Number').fill('512345');
  await page.getByRole('button', { name: 'Submit Registration' }).click();
  await expect(page.getByText('Registration Received')).toBeVisible();
  await page.getByRole('link', { name: 'See Your Roles' }).click();
  await expect(page.getByText('Pending')).toBeVisible();
});
