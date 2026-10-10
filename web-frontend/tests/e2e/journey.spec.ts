import { expect, test } from '@playwright/test';

import { randomMobile, randomPan, staticOtp } from './support/backend';
import { signInWithOtp } from './support/sign-in';

test('a new borrower completes requirement, pre-check, co-applicant consent and case consents, then verifies PAN', async ({ page }) => {
  await signInWithOtp(page, randomMobile());
  await page.getByRole('link', { name: 'Start A New Application' }).first().click();
  await page.getByRole('button', { name: /Business \/ MSME/ }).click();
  await page.getByRole('button', { name: 'Proprietor', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('button[aria-pressed]:not([aria-disabled])').filter({ hasText: /₹/ }).first().click();
  await page.getByLabel('Business Name').fill('Verma Traders');
  await page.getByRole('button', { name: 'Create Application' }).click();

  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+\/requirement$/);
  await expect(page.getByRole('heading', { name: 'How Much Do You Need?' })).toBeVisible();
  await page.getByRole('button', { name: '2 Yrs', exact: true }).click();
  await page.getByRole('button', { name: /Select City/ }).click();
  await page.getByLabel('Search City Or Pincode').fill('Pune');
  await page.getByRole('button', { name: /^Pune/ }).click();
  await expect(page.getByText(/Illustrative EMI/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What Will You Use The Funds For?' })).toBeVisible();
  await page.getByRole('button', { name: 'Business Expansion' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByRole('heading', { name: 'Quick Pre-Check' })).toBeVisible();
  for (const option of ['3–5 Yrs', '₹5–25L']) await page.getByRole('button', { name: option, exact: true }).click();
  const yesNo = page.locator('section').filter({ hasText: 'Any Existing EMIs?' });
  await yesNo.getByRole('button', { name: 'No', exact: true }).click();
  await page.locator('section').filter({ hasText: 'GST Registered?' }).getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/people$/);
  await page.getByRole('button', { name: 'Add A Person' }).click();
  await page.getByLabel('Full Name').fill('Sita Verma');
  await page.getByLabel('Mobile Number').fill(randomMobile());
  await page.getByRole('button', { name: 'Spouse' }).click();
  await page.getByRole('button', { name: 'Add Person' }).click();
  await expect(page.getByText('Sita Verma added')).toBeVisible();
  await page.getByRole('button', { name: 'Get Consent' }).click();
  await expect(page.getByText(/Code sent to/)).toBeVisible();
  await page.getByLabel('Code From Sita Verma').fill(staticOtp());
  await expect(page.getByText('Sita Verma gave consent')).toBeVisible();
  await expect(page.getByText('Consent Given').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page).toHaveURL(/\/consents$/);
  await expect(page.getByRole('heading', { name: 'You Stay In Control' })).toBeVisible();
  await page.getByRole('button', { name: 'I Agree & Continue' }).click();
  await expect(page.getByText('Consent preferences saved')).toBeVisible();
  await expect(page.getByText('Next Up: Documents')).toBeVisible();

  await page.goto('/app');
  await expect(page.getByText('Active Application')).toBeVisible();
  await page.goto('/app/profile');
  await expect(page.getByRole('heading', { name: 'Business Details' })).toBeVisible();
  await page.getByLabel('PAN Number').fill(randomPan('P'));
  await page.getByLabel('Name As On PAN').fill('Asha Verma');
  await page.getByRole('button', { name: 'Verify PAN' }).click();
  await expect(page.getByText('PAN verified')).toBeVisible();
  await expect(page.getByText(/Verified on/)).toBeVisible();
});
