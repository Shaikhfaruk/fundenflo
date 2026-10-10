import { expect, test } from '@playwright/test';

import { inviteLenderUser, liveTestLender, opsReviewDocument, randomEmail, randomMobile, randomPan, type TestLender } from './support/backend';
import { bff, preparedApplication } from './support/bff';
import { writePdf } from './support/pdf';
import { pooledStaffToken } from './support/staff-pool';
import { signInAsLender, signInAsStaff, signInWithOtp } from './support/sign-in';

const LAKH_PAISE = 100_000_00;

let lender: TestLender;
let ops: string;
let lenderEmail: string;

test.beforeAll(async ({ browserName: _browser }, testInfo) => {
  const maker = await pooledStaffToken(`maker-${testInfo.project.name}`);
  ops = await pooledStaffToken(`checker-${testInfo.project.name}`);
  lender = await liveTestLender(`Sahyadri Finance ${String(Date.now()).slice(-5)}`, maker, ops);
  lenderEmail = randomEmail('e2e.lender.desk');
  await inviteLenderUser(lenderEmail, lender.organizationId, maker);
});

test.afterAll(async () => {
  await lender?.cleanUp();
});

test('a borrower uploads documents, gets a score, applies to a matched lender and follows the file', async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const stamp = `${Date.now()}-${testInfo.project.name}`;
  const statement = writePdf(testInfo.outputPath('bank-statement.pdf'), `Statement of account ${stamp}. Closing balance 125000.00`);
  const gstReturns = writePdf(testInfo.outputPath('gst-returns.pdf'), `GSTR-3B summary ${stamp}. Ten returns filed.`);
  const itr = writePdf(testInfo.outputPath('itr.pdf'), `ITR acknowledgement ${stamp}. Total income 18 lakh.`);
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
  await page.getByRole('button', { name: 'Withdraw This Application' }).click();
  await page.getByLabel('Reason').fill('Want to change the amount first');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('Application withdrawn')).toBeVisible();
  await expect(page.getByText('This application was withdrawn.')).toBeVisible();

  await page.goto(`/app/applications/${id}/lenders`);
  await page.getByRole('article').filter({ hasText: lender.name }).getByRole('button', { name: new RegExp(lender.name) }).click();
  await page.getByRole('button', { name: `Share And Apply With ${lender.name}` }).click();
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
  await expect(page.locator('li[aria-current="step"]')).toContainText('Application Received');
  const submissionId = page.url().split('/').pop() ?? '';

  const opsContext = await browser.newContext({ ...testInfo.project.use });
  const opsPage = await opsContext.newPage();
  await signInAsStaff(opsPage, `approver-${testInfo.project.name}`);
  await opsPage.goto(`/ops/submissions/${submissionId}`);
  await opsPage.getByRole('button', { name: 'Approve And Send' }).click();
  await opsPage.getByRole('dialog').getByRole('button', { name: 'Approve And Send' }).click();
  await expect(opsPage.getByText('Submission approved')).toBeVisible();
  await opsContext.close();

  const lenderContext = await browser.newContext({ ...testInfo.project.use });
  const lenderPage = await lenderContext.newPage();
  await signInAsLender(lenderPage, lenderEmail);
  await expect(async () => {
    await lenderPage.reload();
    await expect(lenderPage.getByRole('link', { name: /SB-/ }).first()).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await lenderPage.getByRole('link', { name: /SB-/ }).first().click();
  await expect(lenderPage.getByRole('heading', { name: 'Kapoor Textiles' })).toBeVisible();
  await expect(lenderPage.getByText('Average Monthly Inflow')).toBeVisible();
  await lenderPage.getByRole('button', { name: 'Acknowledge' }).click();
  await lenderPage.getByLabel('Lender Reference (Optional)').fill('SAH-2026-0042');
  await lenderPage.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(lenderPage.getByText('Update recorded')).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(page.locator('li[aria-current="step"]')).toContainText('Lender Review');
  }).toPass({ timeout: 30_000 });
  await lenderPage.getByRole('button', { name: 'Ask For Documents' }).click();
  await lenderPage.getByRole('dialog').getByRole('button', { name: 'Income Tax Return' }).click();
  await lenderPage.getByRole('dialog').getByRole('button', { name: 'Send Request' }).click();
  await expect(lenderPage.getByText('Documents requested')).toBeVisible();

  await page.goto(`/app/applications/${id}/documents`);
  await expect(page.getByText('Lender asked for: Income Tax Return')).toBeVisible();
  await page.getByLabel('Upload ITR Or GST Returns').setInputFiles(itr);
  await expect(page.getByText('ITR Or GST Returns uploaded')).toBeVisible();
  await expect(async () => {
    await lenderPage.reload();
    await expect(lenderPage.getByRole('button', { name: 'Record Sanction' })).toBeVisible();
  }).toPass({ timeout: 45_000 });
  await lenderPage.getByRole('button', { name: 'Record Sanction' }).click();
  await lenderPage.getByLabel('Amount (₹)').fill('1800000');
  await lenderPage.getByRole('dialog').getByRole('button', { name: 'Record Sanction' }).click();
  await expect(lenderPage.getByText('Update recorded').first()).toBeVisible();
  await lenderPage.getByRole('button', { name: 'Record Disbursal' }).click();
  await lenderPage.getByLabel('Amount (₹)').fill('1800000');
  await lenderPage.getByRole('dialog').getByRole('button', { name: 'Record Disbursal' }).click();
  await expect(lenderPage.getByText('Disbursed').first()).toBeVisible();

  await lenderPage.goto('/lender/products');
  await lenderPage.getByRole('link', { name: 'Propose Change' }).click();
  await lenderPage.getByLabel('Largest Loan (₹)').fill('7500000');
  await lenderPage.getByLabel('Reason').fill('Raising our ticket size for MSME working capital');
  await lenderPage.getByRole('button', { name: 'Send For Review' }).click();
  await expect(lenderPage.getByText('Change sent for review')).toBeVisible();
  await expect(lenderPage.getByText('Change v2 waiting for review')).toBeVisible();
  await lenderContext.close();

  await page.goto(`/app/applications/${id}/submissions/${submissionId}`);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Money is on its way to your account.')).toBeVisible();
    await expect(page.locator('li[aria-current="step"]')).toHaveCount(0);
  }).toPass({ timeout: 30_000 });

  await page.goto(`/app/applications/${id}`);
  await expect(page.getByRole('heading', { name: 'Applications Sent' })).toBeVisible();
  await expect(page.getByText('Lender application: Disbursed')).toBeVisible();

  await expect(page.getByText('Loan Disbursed').first()).toBeVisible();
});

test('a borrower withdraws a case they no longer need', async ({ page }) => {
  await signInWithOtp(page, randomMobile());
  await expect(page).toHaveURL(/\/app$/);
  const id = await preparedApplication(bff(page), 'Mehra Bakers', 'Jaipur');
  await page.goto(`/app/applications/${id}`);
  await page.getByRole('button', { name: 'Withdraw Application' }).click();
  await page.getByLabel('Reason').fill('Not needed any more');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('Application withdrawn')).toBeVisible();
  await expect(page.getByText('Withdrawn').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw Application' })).toHaveCount(0);
});

test('an expired or unknown consent link explains what to do next', async ({ page }) => {
  await page.goto('/consent?token=AbCdEfGhIjKlMnOpQrStUvWx');
  await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible();
  await page.goto('/consent');
  await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible();
});
