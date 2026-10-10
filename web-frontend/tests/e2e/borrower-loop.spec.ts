import { expect, test } from '@playwright/test';

import { liveTestLender, opsApproveSubmission, opsReviewDocument, randomMobile, randomPan, staffToken, type TestLender } from './support/backend';
import { bff, preparedApplication } from './support/bff';
import { writePdf } from './support/pdf';
import { signInWithOtp } from './support/sign-in';

const LAKH_PAISE = 100_000_00;

let lender: TestLender;
let ops: string;

test.beforeAll(async () => {
  const maker = await staffToken('super_admin', 'Lender Maker');
  ops = await staffToken('ops_lead', 'Case Reviewer');
  lender = await liveTestLender(`Sahyadri Finance ${String(Date.now()).slice(-5)}`, maker, ops);
});

test.afterAll(async () => {
  await lender?.cleanUp();
});

test('a borrower uploads documents, gets a score, applies to a matched lender and follows the file', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const stamp = `${Date.now()}-${testInfo.project.name}`;
  const statement = writePdf(testInfo.outputPath('bank-statement.pdf'), `Statement of account ${stamp}. Closing balance 125000.00`);
  const gstReturns = writePdf(testInfo.outputPath('gst-returns.pdf'), `GSTR-3B summary ${stamp}. Ten returns filed.`);
  await signInWithOtp(page, randomMobile());
  await expect(page).toHaveURL(/\/app$/);
  const api = bff(page);
  const id = await preparedApplication(api, 'Kapoor Textiles', 'Pune');

  await page.goto(`/app/applications/${id}/documents`);
  await expect(page.getByRole('heading', { name: 'Unlock Your Score With Just 2 Documents' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Get My Health Score/ })).toBeDisabled();
  await page.getByLabel('Upload Bank Statement').setInputFiles(statement);
  await expect(page.getByText('Bank Statement uploaded')).toBeVisible();
  const income = page.getByRole('article', { name: 'ITR Or GST Returns' });
  await income.getByRole('button', { name: 'GST Returns', exact: true }).click();
  await page.getByLabel('Upload ITR Or GST Returns').setInputFiles(gstReturns);
  await expect(page.getByText('ITR Or GST Returns uploaded')).toBeVisible();
  await expect(page.getByText('With our team')).toHaveCount(2, { timeout: 45_000 });

  const documents = await api.get<{ items: Array<{ id: string; documentType: { key: string } }> }>(`/documents?applicationId=${id}`);
  const idOf = (key: string) => documents.items.find((document) => document.documentType.key === key)?.id ?? '';
  await opsReviewDocument(ops, idOf('bank_statement'), [
    { attributeKey: 'banking.avg_monthly_inflow_paise', value: 12 * LAKH_PAISE },
    { attributeKey: 'banking.bounces_6m', value: 1 },
    { attributeKey: 'banking.statement_months', value: 6 },
  ]);
  await opsReviewDocument(ops, idOf('gstr_3b'), [{ attributeKey: 'gst.filed_months_12m', value: 10 }]);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('With our team')).toHaveCount(0);
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: /Get My Health Score/ }).click();
  await expect(page).toHaveURL(/\/analysis\?run=/);
  await expect(page.getByRole('heading', { name: 'Your Documents Are Read' })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/verify$/);
  await expect(page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue To My Score/ })).toBeDisabled();
  await page.getByLabel('PAN Number').fill(randomPan('P'));
  await page.getByLabel('Name As On PAN').fill('Rohit Kapoor');
  await page.getByRole('button', { name: 'Verify PAN' }).click();
  await expect(page.getByText('PAN verified')).toBeVisible();
  await page.getByRole('button', { name: /Continue To My Score/ }).click();

  await expect(page).toHaveURL(/\/score$/);
  await expect(page.getByRole('heading', { name: 'Financial Health Score' })).toBeVisible();
  await expect(page.getByText('Not A CIBIL Or Bureau Score')).toBeVisible();
  await expect(page.getByRole('img', { name: /Score \d+ out of 100/ })).toBeVisible();
  await expect(page.getByText('Cash Flow & Bank Behaviour')).toBeVisible();
  await page.getByRole('link', { name: /See \d+ Ways? To Improve/ }).click();

  await expect(page).toHaveURL(/\/improve$/);
  await expect(page.getByRole('heading', { name: 'A Few Things Can Widen Your Options' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment Bounces On Your Account' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GST Returns Missing For Some Months' })).toBeVisible();
  await page.getByRole('link', { name: /Continue With Matched Lenders/ }).click();

  await expect(page).toHaveURL(/\/lenders$/);
  await expect(page.getByRole('heading', { name: 'Lenders That Fit You' })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: lender.name });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: new RegExp(lender.name) }).click();
  await card.getByRole('button', { name: 'Why This Lender?' }).click();
  await expect(card.getByText('You are GST registered')).toBeVisible();
  await page.getByRole('button', { name: `Share And Apply With ${lender.name}` }).click();

  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
  await expect(page.getByText(`Application sent to ${lender.name}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(lender.name) })).toBeVisible();
  await expect(page.locator('li[aria-current="step"]')).toContainText('Application Received');
  const submissionId = page.url().split('/').pop() ?? '';

  expect((await opsApproveSubmission(ops, submissionId)).status).toBe('approved');
  await expect(async () => {
    await page.reload();
    await expect(page.locator('li[aria-current="step"]')).toContainText('Sent To Lender');
  }).toPass({ timeout: 30_000 });

  await page.goto(`/app/applications/${id}`);
  await expect(page.getByRole('heading', { name: 'Applications Sent' })).toBeVisible();
  await expect(page.getByText('Lender application: Sent To Lender')).toBeVisible();

  await page.goto(`/app/applications/${id}/submissions/${submissionId}`);
  await page.getByRole('button', { name: 'Withdraw This Application' }).click();
  await page.getByLabel('Reason').fill('Found a better offer elsewhere');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('Application withdrawn')).toBeVisible();
  await expect(page.getByText('This application was withdrawn.')).toBeVisible();

  await page.goto(`/app/applications/${id}`);
  await page.getByRole('button', { name: 'Withdraw Application' }).click();
  await page.getByLabel('Reason').fill('Not needed any more');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('Application withdrawn')).toBeVisible();
  await expect(page.getByText('Withdrawn').first()).toBeVisible();
});

test('an expired or unknown consent link explains what to do next', async ({ page }) => {
  await page.goto('/consent?token=AbCdEfGhIjKlMnOpQrStUvWx');
  await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible();
  await page.goto('/consent');
  await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible();
});
