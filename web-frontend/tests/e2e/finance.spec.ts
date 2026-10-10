import { expect, test } from '@playwright/test';

import { liveTestLender, type TestFirm, type TestLender, verifiedFirm } from './support/backend';
import { type DisbursedCase, disbursedPartnerCase, withCommission } from './support/finance';
import { loadApiSession, signInAsStaff } from './support/sign-in';
import { pooledStaffToken } from './support/staff-pool';

const PAISE_PER_RUPEE = 100;

let lender: TestLender;
let firm: TestFirm;
let seeded: DisbursedCase;
let removeCommission: () => Promise<void>;

test.beforeAll(async ({ browserName: _browser }, testInfo) => {
  test.setTimeout(240_000);
  const project = testInfo.project.name;
  const maker = await pooledStaffToken(`maker-${project}`);
  const checker = await pooledStaffToken(`checker-${project}`);
  const ops = await pooledStaffToken(`approver-${project}`);
  const stamp = `${Date.now()}-${project}`;
  lender = await liveTestLender(`Ganga Finance ${project.toUpperCase()} ${String(Date.now()).slice(-5)}`, maker, checker);
  removeCommission = await withCommission(lender, maker, checker);
  firm = await verifiedFirm(maker, checker, `Kulkarni & Co ${stamp}`);
  seeded = await disbursedPartnerCase(firm, lender, maker, ops, stamp);
});

test.afterAll(async () => {
  await removeCommission?.();
  await lender?.cleanUp();
});

test('finance invoices and collects a lender fee, pays the partner with two people and keeps the books balanced', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const project = testInfo.project.name;
  const invoiceNumber = `FF/E2E/${String(Date.now()).slice(-6)}`;
  const utr = `NEFT${String(Date.now()).slice(-9)}`;
  await signInAsStaff(page, `finance-${project}`);

  await page.goto('/finance/receivables');
  await expect(page.getByRole('heading', { name: 'Receivables', exact: true })).toBeVisible();
  await page.getByRole('button', { name: seeded.receivableRef, exact: true }).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Accrued', { exact: true }).first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Record Invoice' }).click();
  await page.getByRole('dialog').last().getByLabel('Invoice number').fill(invoiceNumber);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Record Invoice' }).click();
  await expect(page.getByText('Receivable updated')).toBeVisible();
  await expect(sheet.getByText('Invoiced', { exact: true }).first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Record Payment' }).click();
  const payment = page.getByRole('dialog').last();
  await expect(payment.getByLabel('Amount (₹)')).toHaveValue(String(Math.round(seeded.totalPaise / PAISE_PER_RUPEE)));
  await payment.getByLabel('UTR').fill(utr);
  await payment.getByRole('button', { name: 'Record Payment' }).click();
  await expect(sheet.getByText('Received', { exact: true }).first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Mark Reconciled' }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Mark Reconciled' }).click();
  await expect(sheet.getByText('Reconciled', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/finance/payouts');
  await page.getByRole('button', { name: seeded.payoutRef, exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole('dialog').getByText(firm.name)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Payout updated')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Mark Paid' })).toBeVisible();

  const treasuryContext = await browser.newContext({ ...testInfo.project.use });
  const treasury = await treasuryContext.newPage();
  await signInAsStaff(treasury, `treasurer-${project}`);
  await treasury.goto('/finance/payouts');
  await treasury.getByRole('button', { name: seeded.payoutRef, exact: true }).filter({ visible: true }).first().click();
  await treasury.getByRole('dialog').getByRole('button', { name: 'Mark Paid' }).click();
  const paid = treasury.getByRole('dialog').last();
  await paid.getByLabel('UTR').fill(`IMPS${String(Date.now()).slice(-9)}`);
  await paid.getByRole('button', { name: 'Mark Paid' }).click();
  await expect(treasury.getByText('Payout updated')).toBeVisible();
  await expect(treasury.getByRole('dialog').getByText('Paid', { exact: true }).first()).toBeVisible();
  await treasuryContext.close();

  await page.goto('/finance/reconciliation');
  await page.getByRole('button', { name: 'Run Reconciliation' }).click();
  await page.getByRole('dialog').getByLabel('Statement lines').fill(`RC-99-${String(Date.now()).slice(-6)}, 1200`);
  await page.getByRole('dialog').getByRole('button', { name: 'Match Lines' }).click();
  await expect(page.getByText('Matched 0 of 1 lines')).toBeVisible();
  await expect(page.getByText(/not found/).filter({ visible: true }).first()).toBeVisible();

  await page.goto('/finance/ledger');
  await expect(page.getByText(/^Balanced: debits and credits are both/)).toBeVisible();

  const partnerContext = await browser.newContext({ ...testInfo.project.use });
  const partner = await partnerContext.newPage();
  await loadApiSession(partner, firm.session, 'partner');
  await partner.goto('/partner/commissions');
  await expect(partner.getByText(seeded.payoutRef).filter({ visible: true }).first()).toBeVisible();
  await partnerContext.close();
});
