import { expect, type Page } from '@playwright/test';

import { staticOtp } from './backend';

export async function signInWithOtp(page: Page, mobile: string, as: 'Borrower' | 'Chartered accountant' | 'DSA / loan agent' = 'Borrower') {
  await page.goto('/login');
  await page.getByText(as, { exact: true }).click();
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText(/Sent to \+91/)).toBeVisible();
  await page.getByLabel('6-digit code').fill(staticOtp());
}
