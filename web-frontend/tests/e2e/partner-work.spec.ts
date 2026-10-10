import { expect, test } from '@playwright/test';

import { approveAsOps, assignedLead, liveTestLender, opsReviewDocument, randomMobile, randomPan, staticOtp, type TestLender, verifiedFirm } from './support/backend';
import { bff } from './support/bff';
import { writePdf } from './support/pdf';
import { pooledStaffToken } from './support/staff-pool';
import { signInWithOtp, loadApiSession } from './support/sign-in';

const LAKH_PAISE = 100_000_00;

const DAY_MS = 24 * 60 * 60 * 1000;

const localDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

let maker: string;
let checker: string;
let ops: string;
let lender: TestLender;

test.beforeAll(async ({ browserName: _browser }, testInfo) => {
  maker = await pooledStaffToken(`maker-${testInfo.project.name}`);
  checker = await pooledStaffToken(`checker-${testInfo.project.name}`);
  ops = await pooledStaffToken(`ops-${testInfo.project.name}`);
  lender = await liveTestLender(`Konkan Capital ${testInfo.project.name.toUpperCase()} ${String(Date.now()).slice(-5)}`, maker, checker);
});

test.afterAll(async () => {
  await lender?.cleanUp();
});

test('a CA accepts an offered lead, calls, follows up, reports a loan and starts an application', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const firm = await verifiedFirm(maker, checker, `Patil & Associates ${Date.now()}-${testInfo.project.name}`);
  await assignedLead(ops, firm.organizationId, 'Kiran Patil', 'Patil Traders');
  await signInWithOtp(page, firm.mobile, 'Chartered Accountant');
  await expect(page).toHaveURL(/\/partner$/);
  await expect(page.getByText('Offers Waiting')).toBeVisible();

  await page.goto('/partner/leads');
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Kiran P.' }).first().click();
  await expect(page).toHaveURL(/\/partner\/leads\/[0-9a-f-]+$/);
  await expect(page.getByText(/Accept by .* or the offer moves to another firm/)).toBeVisible();
  await expect(page.getByText('Accept the lead to see the full number.')).toBeVisible();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText('Lead accepted. Call the borrower soon.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kiran Patil' })).toBeVisible();

  await page.getByRole('button', { name: 'Show Number' }).click();
  const reveal = page.getByRole('dialog');
  await reveal.getByLabel('Reason').fill('First call about documents');
  await reveal.getByRole('button', { name: 'Show Number' }).click();
  await expect(page.getByText('Viewing the number was logged.')).toBeVisible();
  await expect(page.locator('a[href^="tel:+91"]')).toBeVisible();

  await page.getByRole('button', { name: 'Connected', exact: true }).click();
  await page.getByLabel('Note', { exact: true }).fill('Discussed bank statements and GST returns');
  await page.getByRole('button', { name: 'Log Activity' }).click();
  await expect(page.getByText('Activity logged')).toBeVisible();
  await expect(page.getByText('Discussed bank statements and GST returns')).toBeVisible();

  await page.getByRole('button', { name: 'Follow-Up' }).click();
  const followUp = page.getByRole('dialog');
  await followUp.getByLabel('Due').fill(`${localDate(1)}T10:30`);
  await followUp.getByLabel('What To Do').fill('Collect six months of statements');
  await followUp.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Follow-up scheduled')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog');
  await edit.getByLabel('Tenure (months)').fill('36');
  await edit.getByRole('button', { name: 'Immediately' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Lead updated')).toBeVisible();

  await page.getByRole('button', { name: 'Report Offline Loan' }).click();
  const conversion = page.getByRole('dialog');
  await conversion.getByLabel('Lender').fill('Saraswat Co-operative Bank');
  await conversion.getByLabel('Sanctioned (₹)').fill('1400000');
  await conversion.getByLabel('Sanctioned On').fill(localDate(-2));
  await conversion.getByRole('button', { name: 'Report' }).click();
  await expect(page.getByText('Offline loan reported')).toBeVisible();
  await expect(page.getByText('Saraswat Co-operative Bank')).toBeVisible();

  await page.goto('/partner/follow-ups');
  await expect(page.getByText('Collect six months of statements')).toBeVisible();
  await expect(page.getByRole('link', { name: /Kiran Patil · LD-/ })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('Follow-up updated')).toBeVisible();
  await expect(page.getByText('All Caught Up')).toBeVisible();

  await page.goto('/partner/leads');
  await page.getByRole('tab', { name: 'Working' }).click();
  await page.getByRole('link', { name: 'Kiran Patil' }).first().click();
  await page.getByRole('button', { name: 'Start Application' }).click();
  const convert = page.getByRole('dialog');
  await convert.getByRole('button', { name: 'Proprietor', exact: true }).click();
  await convert.getByRole('button', { name: 'Start Application' }).click();
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/requirement$/);

  await page.goto('/partner/applications');
  await expect(page.getByRole('link', { name: /Patil Traders/ }).first()).toBeVisible();
});

test('a CA adds a client, takes consent by SMS code and files the case with a matched lender', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const stamp = `${Date.now()}-${testInfo.project.name}`;
  const firm = await verifiedFirm(maker, checker, `Arora Tax Advisors ${stamp}`);
  const statement = writePdf(testInfo.outputPath('bank-statement.pdf'), `Statement of account ${stamp}. Closing balance 210000.00`);
  const gstReturns = writePdf(testInfo.outputPath('gst-returns.pdf'), `GSTR-3B summary ${stamp}. Eleven returns filed.`);
  await loadApiSession(page, firm.session, 'partner');
  await page.goto('/partner');
  await expect(page.getByText('Offers Waiting')).toBeVisible();

  await page.goto('/partner/applications');
  await expect(page.getByText('No Clients Yet')).toBeVisible();
  await page.getByRole('link', { name: 'Add A Client' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add A Client' })).toBeVisible();
  await page.getByLabel('Client Name').fill('Gaurav Arora');
  await page.getByLabel('Client Mobile Number').fill(randomMobile());
  await page.getByRole('button', { name: /Business \/ MSME/ }).click();
  await page.getByRole('button', { name: 'Proprietor', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('button[aria-pressed]').filter({ hasText: 'Business Loan' }).click();
  await page.getByLabel('Business Name').fill('Arora Garments');
  await page.getByRole('button', { name: 'Create Application' }).click();
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/requirement$/);
  const id = page.url().split('/').at(-2) ?? '';

  const api = bff(page);
  const created = await api.get<{ version: number }>(`/applications/${id}`);
  await api.patch(`/applications/${id}/requirement`, { purpose: 'expansion', amountPaise: 25 * LAKH_PAISE, tenureMonths: 36, city: 'Nashik' }, created.version);
  await api.put(`/applications/${id}/answers`, {
    stage: 'pre_check',
    answers: [
      { questionKey: 'business_age', value: '3-5' },
      { questionKey: 'monthly_turnover', value: '5-25L' },
      { questionKey: 'existing_emis', value: 'no' },
      { questionKey: 'gst_registered', value: 'yes' },
    ],
  });

  await page.goto(`/partner/applications/${id}/consents`);
  await expect(page.getByRole('heading', { name: 'Borrower Consent' })).toBeVisible();
  await page.getByRole('button', { name: 'Send Code To Gaurav Arora' }).click();
  await expect(page.getByRole('heading', { name: 'Consent From Gaurav Arora' })).toBeVisible();
  await expect(page.getByText('Gaurav Arora agrees to:')).toBeVisible();
  await page.getByLabel('Code From Gaurav Arora').fill(staticOtp());
  await expect(page.getByText('Consent recorded for Gaurav Arora')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/partner/applications/${id}$`));

  await page.goto(`/partner/applications/${id}/documents`);
  await page.getByLabel('Upload Bank Statement').setInputFiles(statement);
  await expect(page.getByText('Bank Statement uploaded')).toBeVisible();
  await page.getByRole('article', { name: 'ITR Or GST Returns' }).getByRole('button', { name: 'GST Returns', exact: true }).click();
  await page.getByLabel('Upload ITR Or GST Returns').setInputFiles(gstReturns);
  await expect(page.getByText('ITR Or GST Returns uploaded')).toBeVisible();
  await expect(page.getByText('With our team')).toHaveCount(2, { timeout: 45_000 });
  const documents = await api.get<{ items: Array<{ id: string; documentType: { key: string } }> }>(`/documents?applicationId=${id}`);
  const idOf = (key: string) => documents.items.find((document) => document.documentType.key === key)?.id ?? '';
  await opsReviewDocument(ops, idOf('bank_statement'), [
    { attributeKey: 'banking.avg_monthly_inflow_paise', value: 14 * LAKH_PAISE },
    { attributeKey: 'banking.bounces_6m', value: 0 },
    { attributeKey: 'banking.statement_months', value: 6 },
  ]);
  await opsReviewDocument(ops, idOf('gstr_3b'), [{ attributeKey: 'gst.filed_months_12m', value: 11 }]);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('With our team')).toHaveCount(0);
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: /Get My Health Score/ }).click();
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/analysis\?run=/);
  await expect(page.getByRole('heading', { name: 'Your Documents Are Read' })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/verify$/);
  await page.getByLabel('PAN Number').fill(randomPan('P'));
  await page.getByLabel('Name As On PAN').fill('Gaurav Arora');
  await page.getByRole('button', { name: 'Verify PAN' }).click();
  await expect(page.getByText('PAN verified')).toBeVisible();
  await page.getByRole('button', { name: /Continue To My Score/ }).click();
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/score$/);
  await expect(page.getByRole('heading', { name: 'Financial Health Score' })).toBeVisible();

  await page.goto(`/partner/applications/${id}/lenders`);
  const card = page.getByRole('article').filter({ hasText: lender.name });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: new RegExp(lender.name) }).click();
  await expect(page.getByText(`Gaurav Arora confirms by SMS code that the file may go to ${lender.name}.`, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: `Get Consent And Apply With ${lender.name}` }).click();
  await expect(page.getByText('Share My File With Lenders I Choose')).toBeVisible();
  await page.getByLabel('Code From Gaurav Arora').fill(staticOtp());
  await expect(page).toHaveURL(/\/partner\/applications\/[0-9a-f-]+\/submissions\/[0-9a-f-]+$/);
  await expect(page.getByText(`Application sent to ${lender.name}`)).toBeVisible();
  const submissionId = page.url().split('/').pop() ?? '';

  const approved = await approveAsOps(ops, submissionId);
  expect(approved.status).toBe('approved');

  await page.goto('/partner/applications');
  await expect(page.getByRole('link', { name: /Arora Garments/ }).first()).toBeVisible();
});

test('a CA refers a borrower, sees the protected referral, claims another and runs the firm pages', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const firm = await verifiedFirm(maker, checker, `Deshmukh & Co ${Date.now()}-${testInfo.project.name}`);
  await loadApiSession(page, firm.session, 'partner');
  await page.goto('/partner');
  await expect(page.getByText('Offers Waiting')).toBeVisible();

  await page.goto('/partner/leads/new');
  await page.getByLabel('Full Name').fill('Sunita Verma');
  await page.getByLabel('Mobile Number').fill(randomMobile());
  await page.getByLabel('Business Name (optional)').fill('Verma Garments');
  await page.getByRole('button', { name: /Business \/ MSME/ }).click();
  await page.getByLabel('Amount').fill('10 lakh');
  await page.getByRole('button', { name: 'Add Lead' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting For Sunita Verma' })).toBeVisible();
  await expect(page.getByText(/is protected for your firm until/)).toBeVisible();
  await page.getByRole('link', { name: 'See Referrals' }).click();
  await expect(page).toHaveURL(/\/partner\/referrals$/);
  await expect(page.getByText('Sunita Verma').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Your Referral Codes')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Copy [A-Z0-9]{8}$/ }).first()).toBeVisible();

  await page.goto('/partner/disputes/new');
  await page.getByLabel("Borrower's Mobile Number").fill(randomMobile());
  await page.getByLabel('What Happened').fill('We introduced this borrower in September at our office');
  await page.getByRole('button', { name: 'Send Claim' }).click();
  await expect(page.getByText(/no other firm protects this borrower/i)).toBeVisible();

  await page.goto('/partner/commissions');
  await expect(page.getByText('Payable Now')).toBeVisible();
  await expect(page.getByText('No payouts this month.')).toBeVisible();

  await page.goto('/partner/team');
  await page.getByLabel('Mobile Number').fill(randomMobile());
  await page.getByRole('button', { name: 'Send Invitation' }).click();
  await expect(page.getByText('Invitation sent')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Invitations' }).getByText(/^\+91 98/)).toBeVisible();

  await page.goto('/partner/profile');
  await page.getByLabel('PAN').fill(randomPan('F'));
  await page.getByLabel('Account Number').fill('502000123456789');
  await page.getByLabel('IFSC').fill('HDFC0001234');
  await page.getByLabel('Account Holder').fill('Deshmukh And Co');
  await page.getByRole('button', { name: 'Save Details' }).click();
  await expect(page.getByText('Firm details saved')).toBeVisible();
  await expect(page.getByText(/On file: account ending 6789/)).toBeVisible();

  await page.goto('/partner/settings');
  await page.getByLabel('Most Open Leads At A Time').fill('25');
  await page.getByRole('button', { name: 'Sat', exact: true }).click();
  await page.getByLabel('Start Time').fill('09:30');
  await page.getByLabel('End Time').fill('18:30');
  await page.getByRole('button', { name: 'Save Capacity' }).click();
  await expect(page.getByText('Capacity saved')).toBeVisible();
  await page.getByLabel('Pincodes').fill('411001, 411002');
  await page.getByRole('button', { name: 'Save Service Areas' }).click();
  await expect(page.getByText('Service areas saved')).toBeVisible();
});
