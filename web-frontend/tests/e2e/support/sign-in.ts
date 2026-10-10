import { expect, type Page } from '@playwright/test';

import { staticOtp } from './backend';

type SignInRole = 'Loan Borrower' | 'Chartered Accountant' | 'DSA / Loan Agent';

export async function signInWithOtp(page: Page, mobile: string, as: SignInRole = 'Loan Borrower') {
  await page.goto('/login');
  if (as !== 'Loan Borrower') {
    await page.getByRole('button', { name: 'Login As' }).click();
    await page.getByRole('button', { name: new RegExp(`^${as.replace('/', '\\/')}`) }).click();
  }
  await page.getByLabel('Mobile Number').fill(mobile);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/Sent To \+91/)).toBeVisible();
  await page.getByLabel('One-Time Code').fill(staticOtp());
}
