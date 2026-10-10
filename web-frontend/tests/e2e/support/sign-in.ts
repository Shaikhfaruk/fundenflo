import { expect, type Page } from '@playwright/test';

import { type SessionTokens, staticOtp } from './backend';
import { staffSession } from './staff-pool';

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
  await loadApiSession(page, await staffSession(key), 'staff');
  await page.goto('/ops/leads');
  await expect(page).toHaveURL(/\/ops\/leads$/);
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
