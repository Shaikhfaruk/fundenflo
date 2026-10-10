import { randomInt } from 'node:crypto';

import { opsReviewDocument, randomEmail, randomMobile, randomPan, staffApi as api, staticOtp, type TestFirm, type TestLender, uploadPdf, waitForStatus } from './backend';

const LAKH_PAISE = 100_000_00;

const POLL_MS = 500;

const POLL_ATTEMPTS = 80;

const poll = async <T>(read: () => Promise<T | null | undefined>, label: string): Promise<T> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const value = await read();
    if (value) return value;
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  throw new Error(`timed out waiting for ${label}`);
};

const publishScheme = async (maker: string, checker: string, key: string, content: Record<string, unknown>) => {
  const created = await api<{ id: string }>('POST', '/admin/commission-schemes', { key, name: { en: key }, content }, maker);
  const draft = await api<{ version: number }>('GET', `/admin/commission-schemes/${created.id}/versions/1`, undefined, maker);
  const submitted = await api<{ changeRequest: { id: string } }>('POST', `/admin/commission-schemes/${created.id}/versions/1/submit`, { reason: 'End-to-end commission scheme' }, maker, draft.version);
  await api('POST', `/admin/change-requests/${submitted.changeRequest.id}/approve`, {}, checker);
  await api('POST', `/admin/commission-schemes/${created.id}/versions/1/publish`, {}, maker);
  return created.id;
};

export async function withCommission(lender: TestLender, maker: string, checker: string) {
  const feeKey = `${lender.key}.fee`;
  const schemes = [
    await publishScheme(maker, checker, feeKey, { party: 'lender', scope: { lenders: [lender.key] }, basis: 'percent', rateBps: 100, gstRateBps: 1800 }),
    await publishScheme(maker, checker, `${lender.key}.ca_share`, { party: 'partner', scope: { partnerKinds: ['ca'], lenders: [lender.key] }, basis: 'percent', base: 'lender_fee', rateBps: 5000, tdsRateBps: 500, tdsNoPanRateBps: 2000 }),
  ];
  const agreements = await api<{ items: Array<{ id: string; version: number }> }>('GET', `/admin/lenders/${lender.id}/agreements`, undefined, maker);
  const agreement = agreements.items[0];
  if (!agreement) throw new Error(`${lender.name} has no agreement`);
  await api('PATCH', `/admin/lenders/${lender.id}/agreements/${agreement.id}`, { commissionSchemeKey: feeKey }, maker, agreement.version);
  return async () => {
    for (const id of schemes) await api('POST', `/admin/commission-schemes/${id}/versions/1/retire`, { reason: 'End-to-end test finished' }, maker).catch(() => null);
  };
}

export type DisbursedCase = { receivableId: string; receivableRef: string; payoutId: string; payoutRef: string; totalPaise: number };

export async function disbursedPartnerCase(firm: TestFirm, lender: TestLender, maker: string, ops: string, stamp: string): Promise<DisbursedCase> {
  const partner = firm.session.accessToken;
  const profile = await api<{ version: number }>('GET', '/partner/profile', undefined, partner);
  await api('PATCH', '/partner/profile', { pan: randomPan('F'), bankAccount: { accountNumber: `50200${String(randomInt(1_000_000_000, 9_999_999_999))}`, ifsc: 'HDFC0001234', holderName: firm.name.slice(0, 60) } }, partner, profile.version);
  const borrower = await api<{ id: string }>('POST', '/partner/borrowers', { name: 'Meena Iyer', mobile: randomMobile(), countryCode: '+91', segment: 'msme', subSegment: 'proprietorship', businessName: `Iyer Foods ${stamp}` }, partner);
  const created = await api<{ id: string; version: number }>('POST', '/partner/applications', { borrowerProfileId: borrower.id, category: 'business' }, partner);
  const id = created.id;
  await api('PATCH', `/applications/${id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH_PAISE, tenureMonths: 36, city: 'Pune' }, partner, created.version);
  await api('PUT', `/applications/${id}/answers`, { stage: 'pre_check', answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }, partner);
  const consent = await api<{ challengeId: string }>('POST', `/partner/applications/${id}/borrower-consent/send`, undefined, partner);
  await api('POST', `/partner/applications/${id}/borrower-consent/verify`, { challengeId: consent.challengeId, code: staticOtp(), items: [{ purpose: 'ai_documents', granted: true }, { purpose: 'lender_sharing', granted: true, organizationIds: [lender.organizationId] }] }, partner);
  const statement = await uploadPdf(partner, id, 'bank_statement', `Statement ${stamp}`);
  const gst = await uploadPdf(partner, id, 'gstr_3b', `GST ${stamp}`);
  await waitForStatus(partner, statement, 'needs_review');
  await waitForStatus(partner, gst, 'needs_review');
  await opsReviewDocument(ops, statement, [
    { attributeKey: 'banking.avg_monthly_inflow_paise', value: 14 * LAKH_PAISE },
    { attributeKey: 'banking.bounces_6m', value: 0 },
    { attributeKey: 'banking.statement_months', value: 6 },
  ]);
  await opsReviewDocument(ops, gst, [{ attributeKey: 'gst.filed_months_12m', value: 11 }]);
  await waitForStatus(partner, statement, 'verified');
  const analysis = await api<{ id: string }>('POST', `/applications/${id}/analyses`, {}, partner);
  await poll(async () => ((await api<{ status: string }>('GET', `/analyses/${analysis.id}`, undefined, partner)).status === 'done' ? true : null), 'analysis');
  const run = await api<{ items: Array<{ id: string; outcome: string; lender: { id: string } }> }>('POST', `/applications/${id}/matches`, {}, partner);
  const match = run.items.find((item) => item.lender.id === lender.id && item.outcome === 'eligible');
  if (!match) throw new Error(`${lender.name} did not match: ${JSON.stringify(run.items.map((item) => [item.lender.id, item.outcome]))}`);
  const submission = await api<{ id: string }>('POST', `/applications/${id}/submissions`, { matchResultId: match.id }, partner);
  const pending = await api<{ version: number }>('GET', `/ops/submissions/${submission.id}`, undefined, ops);
  await api('POST', `/ops/submissions/${submission.id}/approve`, { expectedVersion: pending.version }, ops);
  await poll(async () => ((await api<{ status: string }>('GET', `/ops/submissions/${submission.id}`, undefined, ops)).status === 'sent_to_lender' ? true : null), 'delivery');
  const email = randomEmail('e2e.finance.lender');
  await api('POST', '/admin/invitations', { organizationId: lender.organizationId, role: 'lender_admin', email }, maker);
  await api('POST', '/auth/otp/request', { email, loginAs: 'lender' });
  const lenderSession = await api<{ accessToken: string }>('POST', '/auth/otp/verify', { email, otp: staticOtp() });
  for (const body of [{ action: 'acknowledge' }, { action: 'sanction', amountPaise: 15 * LAKH_PAISE }, { action: 'disburse', amountPaise: 10 * LAKH_PAISE }]) {
    await api('POST', `/lender/submissions/${submission.id}/events`, body, lenderSession.accessToken);
  }
  const receivable = await poll(async () => {
    const page = await api<{ items: Array<{ id: string; ref: string; totalPaise: number; payout: { id: string; ref: string } | null }> }>('GET', `/admin/finance/receivables?submissionId=${submission.id}`, undefined, maker);
    return page.items.find((item) => item.payout);
  }, 'receivable');
  const payout = receivable.payout as { id: string; ref: string };
  return { receivableId: receivable.id, receivableRef: receivable.ref, payoutId: payout.id, payoutRef: payout.ref, totalPaise: receivable.totalPaise };
}
