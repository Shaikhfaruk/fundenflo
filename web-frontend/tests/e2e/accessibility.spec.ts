import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { randomMobile, verifiedFirm } from './support/backend';
import { loadApiSession, signInAsStaff, signInWithOtp } from './support/sign-in';
import { pooledStaffToken } from './support/staff-pool';

const BLOCKING = new Set(['serious', 'critical']);

const SETTLE_MS = 800;

async function expectAccessible(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(SETTLE_MS);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('nextjs-portal').analyze();
  const blocking = results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
  const describe = (node: (typeof blocking)[number]['nodes'][number]) => {
    const data = node.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
    return `${node.target.join(' ')}${data?.contrastRatio ? ` (${data.fgColor} on ${data.bgColor} = ${data.contrastRatio})` : ''}`;
  };
  expect.soft(blocking.map((violation) => `${path} ${violation.id}: ${violation.nodes.map(describe).slice(0, 4).join(' | ')}`)).toEqual([]);
}

test('public pages have no serious accessibility issues', async ({ page }) => {
  for (const path of ['/login', '/login?as=lender', '/staff/login', '/consent?token=unknown-token-value-000000']) await expectAccessible(page, path);
});

test('borrower pages have no serious accessibility issues', async ({ page }) => {
  await signInWithOtp(page, randomMobile());
  await expect(page).toHaveURL(/\/app$/);
  for (const path of ['/app', '/app/applications/new', '/app/profile', '/account', '/account/consents', '/account/notifications']) await expectAccessible(page, path);
});

test('partner pages have no serious accessibility issues', async ({ page }, testInfo) => {
  const maker = await pooledStaffToken(`maker-${testInfo.project.name}`);
  const checker = await pooledStaffToken(`checker-${testInfo.project.name}`);
  const firm = await verifiedFirm(maker, checker, `Access & Co ${Date.now()}-${testInfo.project.name}`);
  await loadApiSession(page, firm.session, 'partner');
  for (const path of ['/partner', '/partner/leads', '/partner/leads/new', '/partner/follow-ups', '/partner/applications', '/partner/applications/new', '/partner/referrals', '/partner/commissions', '/partner/team', '/partner/profile', '/partner/settings']) await expectAccessible(page, path);
});

test('staff pages have no serious accessibility issues', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await signInAsStaff(page, `desk-${testInfo.project.name}`);
  for (const path of ['/ops/leads', '/ops/cases', '/ops/submissions', '/ops/follow-ups', '/ops/risk', '/ops/reports']) await expectAccessible(page, path);
  await signInAsStaff(page, `auditor-${testInfo.project.name}`);
  for (const path of ['/admin/users', '/admin/invitations', '/admin/audit', '/admin/change-requests', '/admin/catalog/segments', '/admin/attributes', '/admin/attributes/playground', '/admin/scoring-models', '/admin/imports', '/admin/partners', '/admin/lenders', '/finance/receivables', '/finance/payouts', '/finance/reconciliation', '/finance/ledger']) await expectAccessible(page, path);
});
