import { expect, test } from '@playwright/test';

import { randomMobile, staticOtp } from './support/backend';
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

test('a person who picked the wrong role switches to DSA without waiting and reuses a code just sent', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Mobile Number').fill(randomMobile());
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/Sent To \+91/)).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Login As' }).click();
  await page.getByRole('button', { name: /^DSA \/ Loan Agent/ }).click();
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/Sent To \+91/)).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/We sent you a code a moment ago/)).toBeVisible();
  await expect(page.getByText(/Sent To \+91/)).toBeVisible();
  await page.getByLabel('One-Time Code').fill(staticOtp());
  await expect(page).toHaveURL(/\/partner\/signup$/);
});
