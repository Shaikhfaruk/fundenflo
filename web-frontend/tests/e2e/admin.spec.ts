import { writeFileSync } from 'node:fs';

import { expect, type Page, test } from '@playwright/test';

import { randomEmail, randomMobile, staffApi, staticOtp } from './support/backend';
import { signInAsStaff } from './support/sign-in';

const IMPORT_TIMEOUT_MS = 30_000;

const choose = async (page: Page, label: string | RegExp, option: string) => {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

const openRecord = async (page: Page, name: string) => {
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
};

test('an admin adds and edits catalog entries, issues an API key and tries a condition', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${testInfo.project.name === 'phone' ? 'p' : 'd'}`;
  await signInAsStaff(page, `admin-${testInfo.project.name}`);

  await page.goto('/admin/lead-sources');
  await expect(page.getByRole('heading', { name: 'Lead Sources', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Lead Source' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Key *').fill(`e2e_src_${stamp}`);
  await sheet.getByLabel('Name *').fill(`Diwali landing ${stamp}`);
  await choose(page, 'Kind *', 'Web form');
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Lead source created')).toBeVisible();

  await openRecord(page, `Diwali landing ${stamp}`);
  const edit = page.getByRole('dialog');
  await edit.getByLabel('Name *').fill(`Diwali landing page ${stamp}`);
  await choose(page, 'Status', 'Inactive');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'API Keys' }).click();
  await expect(page).toHaveURL(/\/admin\/lead-sources\/api-clients$/);
  await page.getByRole('button', { name: 'Create API Key' }).click();
  const keySheet = page.getByRole('dialog');
  await keySheet.getByLabel('Name *').fill(`Landing form ${stamp}`);
  await keySheet.getByRole('button', { name: 'leads:create' }).click();
  await keySheet.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Copy This Key Now' })).toBeVisible();
  await page.getByRole('button', { name: 'I Have Copied It' }).click();
  await openRecord(page, `Landing form ${stamp}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke Key' }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Revoke Key' }).click();
  await expect(page.getByText('Removed', { exact: true })).toBeVisible();

  await page.goto('/admin/catalog/segments');
  await openRecord(page, 'Business / MSME');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Sub-Segments' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Proprietor', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/admin/attributes');
  await page.getByRole('link', { name: 'Condition Playground' }).click();
  await expect(page).toHaveURL(/\/admin\/attributes\/playground$/);
  await page.getByRole('button', { name: 'Evaluate' }).click();
  await expect(page.locator('pre').filter({ hasText: /true|matched|result/i })).toBeVisible();
});

test('a consent template change goes from maker to checker to live and is retired', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const key = `e2e_${Date.now()}_${testInfo.project.name}`;
  const content = { items: [{ purpose: 'marketing', required: false, title: { en: 'Send Me Offers' }, summary: { en: 'Optional · Product news' }, details: { en: 'We tell you about new lender products.' } }] };
  await signInAsStaff(page, `maker-${testInfo.project.name}`);
  await page.goto('/admin/consents/templates');
  await expect(page.getByRole('heading', { name: 'Consent Templates', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New Document' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Key').fill(key);
  await sheet.getByLabel('Name').fill(`Test consent ${key}`);
  await sheet.getByLabel('Content (JSON)').fill(JSON.stringify(content));
  await sheet.getByRole('button', { name: 'Create Draft' }).click();
  await expect(page).toHaveURL(/\/admin\/consents\/templates\/[0-9a-f-]+\?v=1$/);
  await expect(page.getByRole('heading', { name: 'Version 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Submit For Approval' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Marketing consent for a test campaign');
  await page.getByRole('dialog').getByRole('button', { name: 'Submit For Approval' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();

  const checkerContext = await browser.newContext({ ...testInfo.project.use });
  const checker = await checkerContext.newPage();
  await signInAsStaff(checker, `checker-${testInfo.project.name}`);
  await checker.goto('/admin/change-requests');
  await checker.getByRole('link', { name: new RegExp(`${key} · version 1`) }).filter({ visible: true }).first().click();
  await expect(checker.getByRole('heading', { name: 'What Changes' })).toBeVisible();
  await checker.getByRole('button', { name: 'Approve', exact: true }).click();
  await checker.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(checker.getByText('Change approved. The maker can publish it now.')).toBeVisible();
  await checkerContext.close();

  await page.reload();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Version 1 is live')).toBeVisible();

  await page.getByRole('button', { name: 'Retire', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('End of the test campaign');
  await page.getByRole('dialog').getByRole('button', { name: 'Retire', exact: true }).click();
  await expect(page.getByText('Version retired')).toBeVisible();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Document updated')).toBeVisible();
});

test('an admin invites a user, reviews a firm, checks the audit chain and imports leads', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const stamp = `${Date.now()}-${testInfo.project.name}`;
  const mobile = randomMobile();
  await staffApi('POST', '/auth/otp/request', { mobile, countryCode: '+91', loginAs: 'ca' });
  const session = await staffApi<{ accessToken: string }>('POST', '/auth/otp/verify', { mobile, countryCode: '+91', otp: staticOtp() });
  const firmName = `Review & Co ${stamp}`;
  await staffApi('POST', '/partner/signup', { kind: 'ca', firmName, membershipNumber: '512345', serviceAreas: [{ stateGstCode: '27' }] }, session.accessToken);

  await signInAsStaff(page, `auditor-${testInfo.project.name}`);
  await page.goto('/admin/invitations');
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await choose(page, 'Organisation', 'FundenFlo · FundenFlo');
  await choose(page, 'Role', 'Support');
  const email = randomEmail('e2e.invite');
  await page.getByRole('dialog').getByLabel('Work Email').fill(email);
  await page.getByRole('dialog').getByRole('button', { name: 'Send Invitation' }).click();
  await expect(page.getByText(/^Invitation sent to /)).toBeVisible();
  const ours = page.locator('tr, li').filter({ hasText: 'FundenFlo' }).filter({ hasText: 'Support' }).filter({ visible: true }).first();
  await ours.getByRole('button', { name: 'Revoke', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(page.getByText('Invitation revoked')).toBeVisible();

  await page.goto('/admin/users');
  await page.getByLabel('Search by name, mobile or email').fill('Ops Desk');
  await page.getByRole('link', { name: 'Ops Desk' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Roles', exact: true })).toBeVisible();
  await expect(page.getByText('Sign-in Methods')).toBeVisible();

  await page.goto('/admin/partners');
  await page.getByLabel('Search firms').fill(firmName);
  await openRecord(page, firmName);
  await page.getByRole('dialog').getByRole('button', { name: 'Recommend Approval' }).click();
  await page.getByRole('dialog').last().getByLabel('Note').fill('ICAI number checked on the register');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Decision recorded')).toBeVisible();

  await page.goto('/admin/audit');
  await page.getByRole('button', { name: 'Verify The Chain' }).click();
  await expect(page.getByText(/Chain intact/)).toBeVisible({ timeout: 20_000 });

  const csv = testInfo.outputPath(`leads-${stamp}.csv`);
  writeFileSync(csv, `Name,Mobile,City\nAnita Rao,${randomMobile()},Pune\nVikram Sethi,${randomMobile()},Nashik\nNo Phone,,Delhi\n`);
  await page.goto('/admin/imports');
  await page.getByLabel('Choose a file to import').setInputFiles(csv);
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Map Columns' })).toBeVisible();
  await page.getByLabel('Defaults For Every Row (JSON)').fill(JSON.stringify({ source: 'import', segment: 'msme', campaign: `E2E ${stamp}`, consent: { basis: 'consent', evidence: 'Website form checkbox, test import', purposes: ['contact'] } }));
  await page.getByRole('button', { name: 'Save And Check Rows' }).click();
  await expect(page.getByRole('button', { name: 'Add 2 Leads' })).toBeVisible({ timeout: IMPORT_TIMEOUT_MS });
  await expect(page.getByText('Row 4')).toBeVisible();
  await page.getByRole('button', { name: 'Add 2 Leads' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add Leads' }).click();
  await expect(page.getByRole('button', { name: 'Undo Import' })).toBeVisible({ timeout: IMPORT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Undo Import' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Undo Import' }).click();
  await expect(page.getByText('Undone').first()).toBeVisible({ timeout: IMPORT_TIMEOUT_MS });
});
