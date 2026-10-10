import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { toInvitationRecipient } from '../../src/modules/access/application/invitation-recipient.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { CommissionService } from '../../src/modules/commissions/application/commission.service.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { SubmissionService } from '../../src/modules/submissions/application/submission.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, inviteBySystem, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXY';

const firmPan = () => `AAAF${LETTERS[randomInt(0, LETTERS.length)]}${String(randomInt(0, 10_000)).padStart(4, '0')}${LETTERS[randomInt(0, LETTERS.length)]}`;

const product = {
  category: 'business',
  segments: ['msme'],
  amountPaise: { min: 5 * LAKH, max: 50 * LAKH },
  tenureMonths: { min: 12, max: 60 },
  coverage: { states: ['06'] },
  eligibility: { hard: [{ id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true } }], soft: [] },
  documents: [{ key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' }],
};

describe('commission schemes, accrual, receivables, reconciliation and partner payouts', () => {
  let t: TestApp;
  let manager: StaffSession;
  let ops: StaffSession;
  let finance: StaffSession;
  let treasurer: StaffSession;
  let owner: AuthResult;
  let firm: string;
  let lender: { id: string; organizationId: string };
  let submissionId: string;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version?: number) => {
      const request = t.api().patch(`/v1${path}`).set(bearer(session.accessToken));
      return (version === undefined ? request : request.set('If-Match', `"${version}"`)).send(body);
    },
  });

  const publish = async (maker: StaffSession, resource: string, key: string, content: Record<string, unknown>) => {
    const created = await as(maker).post(`/admin/${resource}`, { key, name: { en: key }, content }).expect(201);
    const submitted = await as(maker).post(`/admin/${resource}/${created.body.id}/versions/1/submit`, { reason: 'Commercials signed' }).expect(200);
    await as(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await as(maker).post(`/admin/${resource}/${created.body.id}/versions/1/publish`).expect(200);
    return created.body.id as string;
  };

  const disbursals = async () => t.prisma.outboxEvent.findMany({ where: { eventName: 'submission.disbursed', aggregateId: submissionId }, orderBy: { occurredAt: 'asc' } });

  const accrue = (event: { id: string; payload: unknown }) => inCls(() => t.app.get(CommissionService).accrue(event.id, event.payload as Record<string, never>));

  beforeAll(async () => {
    t = await startTestApp();
    manager = await createStaffSession(t, Role.lender_manager, 'Pooja Rao');
    ops = await createStaffSession(t, Role.ops_lead, 'Arjun Das');
    finance = await createStaffSession(t, Role.finance, 'Smita Joshi');
    treasurer = await createStaffSession(t, Role.finance, 'Hari Menon');

    const created = await as(manager).post('/admin/lenders', { key: 'comm_lender', name: 'Commission Finance', kind: 'nbfc' }).expect(201);
    lender = { id: created.body.id, organizationId: created.body.organizationId };
    await as(manager).patch(`/admin/lenders/${lender.id}`, { status: 'active' }, created.body.version).expect(200);
    const agreement = await as(manager).post(`/admin/lenders/${lender.id}/agreements`, { reference: 'CM-1', validFrom: new Date().toISOString().slice(0, 10), commissionSchemeKey: 'comm_lender.fee' }).expect(201);
    await as(manager).patch(`/admin/lenders/${lender.id}/agreements/${agreement.body.id}`, { status: 'active' }, agreement.body.version).expect(200);
    await publish(manager, 'lender-products', 'comm_lender.business', product);

    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firm = await createPartnerFirm(t, { name: 'Rao Tax Consultants', cityId: gurugramId, signedUpByUserId: ops.user.id });
    owner = await createPartnerSession(t, firm);
  });

  afterAll(async () => {
    const current = await as(manager).get(`/admin/lenders/${lender.id}`).expect(200);
    await as(manager).patch(`/admin/lenders/${lender.id}`, { status: 'offboarded' }, current.body.version).expect(200);
    await t.close();
  });

  it('validates and publishes lender and partner commission schemes through maker-checker', async () => {
    const broken = await as(finance).post('/admin/commission-schemes', { key: 'broken.fee', name: { en: 'Broken' }, content: { party: 'lender', scope: { lenders: ['no_such_lender'] }, basis: 'percent', rateBps: 100 } }).expect(201);
    expect((await as(finance).post(`/admin/commission-schemes/${broken.body.id}/versions/1/submit`, { reason: 'Try' }).expect(400)).body.details[0]).toMatchObject({ code: 'unknown_key', path: 'content.scope.lenders.0' });
    const partial = await as(finance).post('/admin/commission-schemes', { key: 'broken.flat', name: { en: 'Broken flat' }, content: { party: 'partner', basis: 'flat' } }).expect(400);
    expect(partial.body.details[0].path).toContain('flatPaise');
    await as(owner).get('/admin/commission-schemes').expect(403);
    await publish(finance, 'commission-schemes', 'comm_lender.fee', { party: 'lender', scope: { lenders: ['comm_lender'] }, basis: 'percent', rateBps: 100, gstRateBps: 1800 });
    await publish(finance, 'commission-schemes', 'partner.ca_share', { party: 'partner', scope: { partnerKinds: ['ca'], lenders: ['comm_lender'] }, basis: 'percent', base: 'lender_fee', rateBps: 5000, tdsRateBps: 500, tdsNoPanRateBps: 2000 });
  });

  it('accrues a receivable and a partner payout on disbursal and pays the partner after the lender pays', async () => {
    const mobile = randomMobile();
    await as(owner).post('/partner/leads', { mobile, name: 'Vivek Anand', segment: 'msme', requestConsent: false }).expect(201);
    const borrower = await otpLogin(t, mobile, LoginAs.borrower);
    const templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
    const application = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Anand Steels', category: 'business' }).expect(201);
    expect(application.body.leadId).not.toBeNull();
    await as(borrower).patch(`/applications/${application.body.id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, application.body.version).expect(200);
    await as(borrower).put(`/applications/${application.body.id}/answers`, { answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    await as(borrower).post(`/applications/${application.body.id}/consents`, { templateVersionId, items: [{ purpose: 'ai_documents', granted: true }, { purpose: 'lender_sharing', granted: true, organizationIds: [lender.organizationId] }] }).expect(200);
    await t.prisma.loanApplication.update({ where: { id: application.body.id }, data: { status: 'assessed', scoredAt: new Date() } });
    const statement = await t.api().post('/v1/documents').set(bearer(borrower.accessToken)).field('documentType', 'bank_statement').field('applicationId', application.body.id).attach('file', Buffer.from('%PDF-1.7\nstatement\n%%EOF\n'), { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(await inCls(() => t.app.get(DocumentScanService).scan(statement.body.id))).toBe('clean');
    const matched = await as(borrower).post(`/applications/${application.body.id}/matches`).expect(201);
    const result = matched.body.items.find((item: { lender: { id: string } }) => item.lender.id === lender.id);
    const submission = await as(borrower).post(`/applications/${application.body.id}/submissions`, { matchResultId: result.id }).expect(201);
    submissionId = submission.body.id;
    await as(ops).post(`/ops/submissions/${submissionId}/approve`).expect(200);
    expect(await inCls(() => t.app.get(SubmissionService).deliver(submissionId))).toMatchObject({ delivered: true });
    const lenderMobile = randomMobile();
    await inviteBySystem(t, { organizationId: lender.organizationId, role: Role.lender_admin, ...toInvitationRecipient({ mobile: lenderMobile, countryCode: '+91' }) });
    const lenderAdmin = await otpLogin(t, lenderMobile, LoginAs.lender);
    await as(lenderAdmin).post(`/lender/submissions/${submissionId}/events`, { action: 'acknowledge' }).expect(200);
    await as(lenderAdmin).post(`/lender/submissions/${submissionId}/events`, { action: 'sanction', amountPaise: 15 * LAKH }).expect(200);
    await as(lenderAdmin).post(`/lender/submissions/${submissionId}/events`, { action: 'disburse', amountPaise: 10 * LAKH }).expect(200);

    const [first] = await disbursals();
    const accrued = await accrue(first as { id: string; payload: unknown });
    expect(accrued?.payoutId).toBeTruthy();
    expect(await accrue(first as { id: string; payload: unknown })).toEqual(accrued);
    const receivable = await as(finance).get(`/admin/finance/receivables/${accrued?.receivableId}`).expect(200);
    expect(receivable.body).toMatchObject({ status: 'accrued', basePaise: 10 * LAKH, feePaise: 1_000_000, gstRateBps: 1800, gstPaise: 180_000, totalPaise: 1_180_000, outstandingPaise: 1_180_000, payout: { status: 'pending', grossPaise: 500_000, netPaise: 400_000 } });
    expect(receivable.body.ref).toMatch(/^RC-/);
    const payoutId = accrued?.payoutId as string;
    await as(owner).get('/admin/finance/receivables').expect(403);

    expect((await as(finance).post(`/admin/finance/payouts/${payoutId}/approve`).expect(400)).body.details[0].code).toBe('awaiting_lender_payment');
    await as(finance).patch(`/admin/finance/receivables/${accrued?.receivableId}`, { action: 'invoice', invoiceNumber: 'FF/26/0001' }).expect(200);
    const partial = await as(finance).patch(`/admin/finance/receivables/${accrued?.receivableId}`, { action: 'receive', amountPaise: 500_000, utr: 'HDFC00012345' }).expect(200);
    expect(partial.body).toMatchObject({ status: 'invoiced', receivedPaise: 500_000, outstandingPaise: 680_000 });
    expect((await as(finance).patch(`/admin/finance/receivables/${accrued?.receivableId}`, { action: 'receive', amountPaise: 700_000 }).expect(400)).body.details[0].code).toBe('over_payment');
    const run = await as(finance).post('/admin/finance/reconciliation', { lenderId: lender.id, source: 'lender_statement', lines: [{ reference: 'FF/26/0001', amountPaise: 680_000, utr: 'HDFC00012399' }, { reference: 'RC-99-999999', amountPaise: 1_000 }] }).expect(201);
    expect(run.body).toMatchObject({ lineCount: 2, matchedCount: 1, matchedPaise: 680_000, reconciledReceivableIds: [accrued?.receivableId], unmatched: [{ reference: 'RC-99-999999', reason: 'not_found' }] });
    expect((await as(finance).get(`/admin/finance/receivables/${accrued?.receivableId}`).expect(200)).body).toMatchObject({ status: 'reconciled', reconciliationRunId: run.body.id, outstandingPaise: 0 });
    expect((await as(finance).get('/admin/finance/reconciliation').expect(200)).body.items[0].id).toBe(run.body.id);

    expect((await as(finance).post(`/admin/finance/payouts/${payoutId}/approve`).expect(400)).body.details[0].code).toBe('kyc_incomplete');
    await as(owner).patch('/partner/profile', { pan: firmPan(), bankAccount: { accountNumber: '502000987654321', ifsc: 'ICIC0004321', holderName: 'Rao Tax Consultants' } }).expect(200);
    const approved = await as(finance).post(`/admin/finance/payouts/${payoutId}/approve`).expect(200);
    expect(approved.body).toMatchObject({ status: 'approved', tdsRateBps: 500, tdsPaise: 25_000, netPaise: 475_000 });
    const detail = await as(treasurer).get(`/admin/finance/payouts/${payoutId}`).expect(200);
    expect(detail.body.bankAccount).toEqual({ accountNumber: '502000987654321', ifsc: 'ICIC0004321', holderName: 'Rao Tax Consultants' });
    expect((await as(finance).post(`/admin/finance/payouts/${payoutId}/mark-paid`, { utr: 'NEFT00098765' }).expect(403)).body.details.reason).toBe('second_person_required');
    const paid = await as(treasurer).post(`/admin/finance/payouts/${payoutId}/mark-paid`, { utr: 'NEFT00098765' }).expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', utr: 'NEFT00098765' });

    const summary = await as(owner).get('/partner/commissions/summary').expect(200);
    expect(summary.body).toMatchObject({ payablePaise: 0, byStatus: { paid: { count: 1, grossPaise: 500_000, tdsPaise: 25_000, netPaise: 475_000 } } });
    const ledger = await as(owner).get('/partner/commissions/ledger').expect(200);
    expect(ledger.body.items.map((item: { kind: string; debitPaise: number; creditPaise: number }) => [item.kind, item.debitPaise, item.creditPaise])).toEqual([
      ['payout_paid', 500_000, 0],
      ['payout_accrued', 0, 500_000],
    ]);
    const month = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);
    const monthly = await as(owner).get('/partner/commissions/statement').query({ month }).expect(200);
    expect(monthly.body).toMatchObject({ month, openingPayablePaise: 0, closingPayablePaise: 0, paid: { count: 1, netPaise: 475_000 } });
    expect(monthly.body.items[0]).not.toHaveProperty('approvedByUserId');
    const agent = await createPartnerSession(t, firm, Role.partner_agent);
    await as(agent).get('/partner/commissions/statement').query({ month }).expect(403);
  });

  it('writes off an unpaid tranche, reverses its payout and keeps the ledger balanced', async () => {
    const mobile = randomMobile();
    await inviteBySystem(t, { organizationId: lender.organizationId, role: Role.lender_credit_officer, ...toInvitationRecipient({ mobile, countryCode: '+91' }) });
    const lenderSession = await otpLogin(t, mobile, LoginAs.lender);
    await as(lenderSession).post(`/lender/submissions/${submissionId}/events`, { action: 'disburse', amountPaise: 5 * LAKH }).expect(200);
    const [, second] = await disbursals();
    const accrued = await accrue(second as { id: string; payload: unknown });
    const receivableId = accrued?.receivableId as string;
    expect((await as(finance).get(`/admin/finance/receivables/${receivableId}`).expect(200)).body).toMatchObject({ basePaise: 5 * LAKH, feePaise: 500_000, payout: { status: 'pending', grossPaise: 250_000 } });
    await as(finance).patch(`/admin/finance/receivables/${receivableId}`, { action: 'write_off' }).expect(400);
    const written = await as(finance).patch(`/admin/finance/receivables/${receivableId}`, { action: 'write_off', reason: 'Lender disputes the tranche fee' }).expect(200);
    expect(written.body).toMatchObject({ status: 'written_off', outstandingPaise: 0, payout: { status: 'reversed' } });
    await as(finance).post(`/admin/finance/payouts/${accrued?.payoutId}/approve`).expect(409);

    const trial = await as(finance).get('/admin/finance/ledger/trial-balance').expect(200);
    expect(trial.body.totals.debitPaise).toBe(trial.body.totals.creditPaise);
    const balance = (code: string) => trial.body.items.find((item: { code: string }) => item.code === code)?.balancePaise;
    expect(balance(`lender_receivable:${lender.organizationId}`)).toBe(0);
    expect(balance(`partner_payable:${firm}`)).toBe(0);
    await expect(t.prisma.$executeRaw`UPDATE ledger_entries SET debit_paise = debit_paise + 1`).rejects.toThrow();
    await expect(
      t.prisma.$transaction(async (tx) => {
        const journal = await tx.ledgerJournal.create({ data: { kind: 'payout_paid', sourceType: 'integration_check', sourceId: firm, memo: 'one-sided' } });
        const account = await tx.ledgerAccount.findFirstOrThrow({ where: { code: 'bank' } });
        await tx.ledgerEntry.create({ data: { journalId: journal.id, accountId: account.id, debitPaise: 1n } });
      }),
    ).rejects.toThrow(/not balanced/);
  });
});
