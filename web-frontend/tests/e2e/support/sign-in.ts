import { expect, type Page } from '@playwright/test';
import { staticOtp } from './backend';
import { freshCode, staffAccount } from './staff-pool';

const TOTP_WAIT_MS = 30_000;

const MFA_ATTEMPTS = 3;

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

export async function signInAsStaff(page: Page, key: string) {
  const account = staffAccount(key);
  await page.goto('/staff/login');
  await page.getByLabel('Work Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Continue' }).click();
  const field = page.getByLabel('Authenticator Code');
  for (let attempt = 1; attempt <= MFA_ATTEMPTS; attempt += 1) {
    await field.fill(freshCode(account.secret));
    try {
      await expect(page).toHaveURL(/\/ops\/leads$/, { timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === MFA_ATTEMPTS) throw error;
      await page.waitForTimeout(TOTP_WAIT_MS - (Date.now() % TOTP_WAIT_MS) + 500);
    }
  }
}
