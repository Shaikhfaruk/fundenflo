import { expect, test } from '@playwright/test';
import { generateSync } from 'otplib';

import { inviteStaff, randomEmail } from './support/backend';

test('a staff member accepts an invitation, enrols an authenticator and opens the lead queue', async ({ page }) => {
  const email = randomEmail('e2e.ops');
  const token = inviteStaff(email, 'ops_lead');
  const password = `Passw0rd-${Date.now()}`;

  await page.goto(`/staff/invite/${token}`);
  await page.getByLabel('Full name').fill('Kavya Iyer');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByText(/Invitation accepted for e2/)).toBeVisible();
  await page.getByLabel('Work email').fill(email);

  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Or enter this key')).toBeVisible();
  const secret = (await page.locator('code').first().textContent())?.trim() ?? '';
  await page.getByLabel('Authenticator code').fill(generateSync({ secret }));
  await expect(page).toHaveURL(/\/ops\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
});
