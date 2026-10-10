import { randomInt } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { caseWithDocuments, opsLeadPerson, randomMobile, requestDataCorrection } from './support/backend';
import { pooledStaffToken } from './support/staff-pool';
import { signInAsStaff } from './support/sign-in';

test('ops reviews a case: keys in document values, verifies, assigns and requests documents', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const business = `Bansal Foods ${randomInt(10_000, 99_999)}`;
  const { applicationId, gstId } = await caseWithDocuments(business);
  await signInAsStaff(page, `ops-${testInfo.project.name}`);

  await page.goto('/ops/cases');
  await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible();
  await page.getByLabel('Search name or reference').fill(business);
  await page.getByRole('link', { name: new RegExp(business) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/ops/cases/${applicationId}$`));
  await expect(page.getByRole('heading', { name: business })).toBeVisible();

  await page.getByRole('listitem').filter({ hasText: 'Bank Statement' }).getByRole('link', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Bank Statement' })).toBeVisible();
  await page.getByLabel('Average Monthly Inflow').fill('1200000');
  await page.getByLabel('Bounced Payments In Six Months').fill('0');
  await page.getByRole('button', { name: 'Verify Document' }).click();
  await expect(page.getByText('Document verified')).toBeVisible();

  await page.goto(`/ops/documents/${gstId}`);
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.getByRole('button', { name: 'Hard to read' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('Document rejected')).toBeVisible();

  await page.getByRole('link', { name: 'Back To Case' }).click();
  await expect(page.getByText('Average Monthly Inflow')).toBeVisible();
  await page.getByRole('button', { name: 'Assign To Me' }).click();
  await expect(page.getByText('Assignment saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unassign' })).toBeVisible();

  await page.getByRole('button', { name: 'Request Documents' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Udyam Registration' }).click();
  await page.getByLabel('Note For The Borrower (Optional)').fill('Please add your Udyam certificate');
  await page.getByRole('button', { name: 'Send Request' }).click();
  await expect(page.getByText('Documents requested')).toBeVisible();
});

test('ops creates a lead, qualifies it, logs a call, reveals the contact and closes a follow-up', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const name = `Ritu Sharma ${randomInt(1_000, 9_999)}`;
  await signInAsStaff(page, `checker-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'New Lead' }).click();
  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('Mobile Number').fill(randomMobile());
  await page.getByLabel('Business Name').fill('Sharma Garments');
  await page.getByLabel('Amount Needed').fill('10 lakh');
  await page.getByRole('button', { name: 'Create Lead' }).click();
  await expect(page).toHaveURL(/\/ops\/leads\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('button', { name: 'Qualify', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Qualify', exact: true }).click();
  await expect(page.getByText('Lead updated')).toBeVisible();
  await expect(page.getByText('Qualified').first()).toBeVisible();

  await page.getByRole('button', { name: 'Connected' }).click();
  await page.getByLabel('Note', { exact: true }).fill('Wants working capital before Diwali');
  await page.getByRole('button', { name: 'Log Activity' }).click();
  await expect(page.getByText('Activity logged')).toBeVisible();
  await expect(page.getByText('Wants working capital before Diwali')).toBeVisible();

  await page.getByRole('button', { name: 'Reveal' }).click();
  await page.getByLabel('Reason').fill('Calling back about the enquiry');
  await page.getByRole('dialog').getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByText(/^\+91 \d{5} \d{5}$/)).toBeVisible();

  await page.getByRole('button', { name: 'Send Consent Link' }).click();
  await expect(page.getByText(/Consent link sent to/)).toBeVisible();

  await page.getByRole('button', { name: 'Follow-Up' }).click();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
  await page.getByLabel('Due').fill(tomorrow);
  await page.getByLabel('What To Do').fill('Call back with lender options');
  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Follow-up scheduled')).toBeVisible();

  await page.goto('/ops/follow-ups');
  const followUp = page.getByRole('listitem').filter({ hasText: 'Call back with lender options' });
  await followUp.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Follow-up updated')).toBeVisible();
});

test('ops opens the risk, signals, reports, duplicates, merges, disputes and data request desks', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signInAsStaff(page, `desk-${testInfo.project.name}`);
  for (const [path, heading] of [
    ['/ops/risk', 'Risk'],
    ['/ops/signals', 'Consistency Signals'],
    ['/ops/reports', 'Reports'],
    ['/ops/parties/match-reviews', 'Possible Duplicates'],
    ['/ops/parties/merges', 'Merge History'],
    ['/ops/disputes', 'Attribution Disputes'],
    ['/ops/data-requests', 'Data Requests'],
    ['/ops/conversions', 'Offline Conversions'],
    ['/ops/submissions', 'Submissions'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.goto('/ops/reports');
  await expect(page.getByRole('heading', { name: 'Lead Funnel' })).toBeVisible();
});

test('ops clears a fraud review, completes a data request, resolves a signal and works a party record', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = randomInt(10_000, 99_999);
  const shared = `Shared statement ${suffix}`;
  const first = await caseWithDocuments(`Kohli Exports ${suffix}`, shared);
  const second = await caseWithDocuments(`Kohli Traders ${suffix}`, shared);
  const correction = await requestDataCorrection(first.token, `Please correct my business name ${suffix}`);
  const opsToken = await pooledStaffToken(`checker-${testInfo.project.name}`);
  const keeper = await opsLeadPerson(opsToken, `Anil Mehra ${suffix}`);
  const duplicate = await opsLeadPerson(opsToken, `Anil Mehra ${suffix}`);
  await signInAsStaff(page, `risk-${testInfo.project.name}`);

  await page.goto('/ops/risk');
  const review = (id: string) => page.locator(`tr:has(a[href$="/ops/cases/${id}"]), li:has(a[href$="/ops/cases/${id}"])`).filter({ has: page.getByRole('button', { name: 'Review' }) });
  const ours = review(first.applicationId).or(review(second.applicationId)).first();
  await expect(async () => {
    await page.reload();
    await expect(ours).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await ours.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText('Same document, other party').first()).toBeVisible();
  await page.getByRole('button', { name: 'Decide' }).click();
  await page.getByRole('dialog', { name: 'Decide This Review' }).getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Reasoning').fill('Both firms share one accountant; statements genuine');
  await page.getByRole('dialog', { name: 'Decide This Review' }).getByRole('button', { name: 'Decide' }).click();
  await expect(page.getByText('Review decided')).toBeVisible();

  await page.goto('/ops/data-requests');
  await page.getByRole('row').filter({ hasText: correction.ref }).or(page.getByRole('listitem').filter({ hasText: correction.ref })).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByText(`Please correct my business name ${suffix}`)).toBeVisible();
  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByLabel('Response').fill('Business name corrected on your profile');
  await page.getByRole('dialog', { name: 'Complete This Request' }).getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByText('Request updated')).toBeVisible();

  await page.goto(`/ops/cases/${first.applicationId}`);
  await page.getByRole('listitem').filter({ hasText: 'Average Monthly Turnover' }).getByRole('button', { name: 'Verify' }).click();
  await page.getByLabel('Confirmed Value').fill('4000000');
  await page.getByLabel('Evidence').fill('GST returns show forty lakh a month');
  await page.getByRole('dialog').getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Fact verified')).toBeVisible();
  await page.goto('/ops/signals');
  await page.locator(`tr:has(a[href$="/ops/cases/${first.applicationId}"]), li:has(a[href$="/ops/cases/${first.applicationId}"])`).filter({ has: page.getByRole('button', { name: 'Resolve' }) }).first().getByRole('button', { name: 'Resolve' }).click();
  await page.getByLabel('What You Checked').fill('Seasonal peak confirmed on a call');
  await page.getByRole('dialog').getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('Signal updated')).toBeVisible();

  await page.goto(`/ops/parties/${first.partyId}`);
  await page.getByRole('button', { name: 'Record Fact' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Detail' }).click();
  await page.getByRole('option', { name: 'Average Monthly Balance' }).click();
  await page.getByRole('dialog').getByLabel('Value').fill('50000');
  await page.getByRole('dialog').getByLabel('Evidence').fill('Bank statement closing balances');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Fact recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Record Consent' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Purpose' }).click();
  await page.getByRole('option', { name: 'Message Me On WhatsApp' }).click();
  await page.getByRole('dialog').getByLabel('Evidence').fill('Agreed on a call today');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Consent recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Record Answer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Business / MSME' }).click();
  await page.getByRole('dialog').getByLabel('Question Key').fill('business_age');
  await page.getByRole('dialog').getByLabel('Answer', { exact: true }).fill('3-5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Answer recorded')).toBeVisible();

  await page.goto(`/ops/parties/${keeper}`);
  await page.getByRole('button', { name: 'Merge A Duplicate' }).click();
  await page.getByLabel('Duplicate Record ID').fill(duplicate);
  await page.getByRole('dialog').getByLabel('Reason').fill('Same exporter registered twice');
  await page.getByRole('dialog').getByRole('button', { name: 'Merge' }).click();
  await expect(page.getByText('Records merged')).toBeVisible();
  await page.goto('/ops/parties/merges');
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Merged the wrong record');
  await page.getByRole('dialog').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Merge undone')).toBeVisible();
});
