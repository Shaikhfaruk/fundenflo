import { expect, type Page } from '@playwright/test';

import { type SessionTokens, staticOtp } from './backend';
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

export async function signInAsLender(page: Page, email: string) {
  await page.goto('/login?as=lender');
  await expect(page.getByLabel('Email Address')).toBeVisible();
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await expect(page.getByText(/Sent To/)).toBeVisible();
  await page.getByLabel('One-Time Code').fill(staticOtp());
  await expect(page).toHaveURL(/\/lender$/);
}

const COOKIE_ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export async function loadApiSession(page: Page, session: SessionTokens, context: string) {
  const url = new URL(COOKIE_ORIGIN);
  const base = { domain: url.hostname, sameSite: 'Lax' as const, secure: url.protocol === 'https:' };
  const expires = Math.floor(Date.now() / 1000) + session.refreshExpiresIn;
  await page.context().addCookies([
    { ...base, name: 'ff_at', value: session.accessToken, path: '/', httpOnly: true, expires: Math.floor(Date.now() / 1000) + session.expiresIn },
    { ...base, name: 'ff_rt', value: session.refreshToken, path: '/api/session', httpOnly: true, expires },
    { ...base, name: 'ff_exp', value: String(Date.now() + session.expiresIn * 1000), path: '/', httpOnly: false, expires },
    { ...base, name: 'ff_ctx', value: context, path: '/', httpOnly: false, expires },
  ]);
}
