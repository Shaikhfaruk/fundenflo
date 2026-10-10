import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { toInvitationRecipient } from '../../src/modules/access/application/invitation-recipient.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { SubmissionChannel, SubmissionService } from '../../src/modules/submissions/application/submission.service.js';
import { bearer, createStaffSession, inviteBySystem, otpLogin, randomMobile, type StaffSession, systemAbility } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const PDF = (label: string) => Buffer.from(`%PDF-1.7\n${label}\n%%EOF\n`);

const product = {
  category: 'business',
  segments: ['msme'],
  amountPaise: { min: 5 * LAKH, max: 50 * LAKH },
  tenureMonths: { min: 12, max: 60 },
  coverage: { states: ['06'] },
  eligibility: { hard: [{ id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, pass: { en: 'You are GST registered' } }], soft: [] },
  documents: [{ key: 'udyam', documentTypes: ['udyam_certificate'], stage: 'submission' }, { key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' }],
};

describe('lender submissions, document requests and lender decisions', () => {
  let t: TestApp;
  let manager: StaffSession;
  let ops: StaffSession;
  let borrower: AuthResult;
  let templateVersionId: string;
  const lenders: Array<{ id: string; organizationId: string }> = [];
  let first: { id: string; organizationId: string };
  let second: { id: string; organizationId: string };

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const service = () => t.app.get(SubmissionService);
  const deliver = (id: string) => inCls(() => service().deliver(id));
  const scan = (id: string) => inCls(() => t.app.get(DocumentScanService).scan(id));

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
    delete: (path: string) => t.api().delete(`/v1${path}`).set(bearer(session.accessToken)),
  });

  const upload = async (session: AuthResult | StaffSession, owner: Record<string, string>, documentType: string, scanned = true) => {
    const request = t.api().post('/v1/documents').set(bearer(session.accessToken)).field('documentType', documentType);
    for (const [key, value] of Object.entries(owner)) request.field(key, value);
    const created = await request.attach('file', PDF(documentType), { filename: `${documentType}.pdf`, contentType: 'application/pdf' }).expect(201);
    if (scanned) expect(await scan(created.body.id)).toBe('clean');
    return created.body.id as string;
  };

  const liveLender = async (key: string, name: string) => {
    const lender = await as(manager).post('/admin/lenders', { key, name, kind: 'nbfc' }).expect(201);
    lenders.push({ id: lender.body.id, organizationId: lender.body.organizationId });
    await as(manager).patch(`/admin/lenders/${lender.body.id}`, { status: 'active' }, lender.body.version).expect(200);
    const agreement = await as(manager).post(`/admin/lenders/${lender.body.id}/agreements`, { reference: `${key}-1`, validFrom: new Date().toISOString().slice(0, 10) }).expect(201);
    await as(manager).patch(`/admin/lenders/${lender.body.id}/agreements/${agreement.body.id}`, { status: 'active' }, agreement.body.version).expect(200);
    const created = await as(manager).post('/admin/lender-products', { key: `${key}.working_capital`, name: { en: `${name} Working Capital` }, content: product }).expect(201);
    const submitted = await as(manager).post(`/admin/lender-products/${created.body.id}/versions/1/submit`, { reason: 'Credit note' }).expect(200);
    await as(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await as(manager).post(`/admin/lender-products/${created.body.id}/versions/1/publish`).expect(200);
    return { id: lender.body.id as string, organizationId: lender.body.organizationId as string };
  };

  const lenderSession = async (organizationId: string, role: Role) => {
    const mobile = randomMobile();
    await inviteBySystem(t, { organizationId, role, ...toInvitationRecipient({ mobile, countryCode: '+91' }) });
    return otpLogin(t, mobile, LoginAs.lender);
  };

  const assessedApplication = async (businessName: string, owner = borrower) => {
    const created = await as(owner).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' }).expect(201);
    const id = created.body.id as string;
    await as(owner).patch(`/applications/${id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, created.body.version).expect(200);
    await as(owner).put(`/applications/${id}/answers`, { answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    await as(owner).post(`/applications/${id}/consents`, { templateVersionId, items: [{ purpose: 'ai_documents', granted: true }] }).expect(200);
    await t.prisma.loanApplication.update({ where: { id }, data: { status: 'assessed', scoredAt: new Date() } });
    const matched = await as(owner).post(`/applications/${id}/matches`).expect(201);
    const results = new Map<string, string>(matched.body.items.map((item: { id: string; lender: { id: string } }) => [item.lender.id, item.id]));
    return { id, results };
  };

  beforeAll(async () => {
    t = await startTestApp();
    manager = await createStaffSession(t, Role.lender_manager, 'Rohan Mehta');
    ops = await createStaffSession(t, Role.ops_lead, 'Farah Khan');
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
    first = await liveLender('submit_first', 'First Finance');
    second = await liveLender('submit_second', 'Second Capital');
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
  });

  afterAll(async () => {
    for (const { id } of lenders) {
      const lender = await as(manager).get(`/admin/lenders/${id}`).expect(200);
      await as(manager).patch(`/admin/lenders/${id}`, { status: 'offboarded' }, lender.body.version).expect(200);
    }
    await t.close();
  });

  it('sends an approved submission with its packet, handles a document request and records sanction and disbursal', async () => {
    const application = await assessedApplication('Mehta Garments');
    const requested = await as(borrower).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(first.id) }).expect(201);
    expect(requested.body).toMatchObject({ status: 'pending_approval', lender: { name: 'First Finance' }, product: { key: 'submit_first.working_capital', name: 'First Finance Working Capital' } });
    expect(requested.body.ref).toMatch(/^SB-/);
    await as(borrower).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(first.id) }).expect(409);
    expect((await as(borrower).get(`/applications/${application.id}`).expect(200)).body.status).toBe('ready_for_submission');
    const rival = await as(borrower).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(second.id) }).expect(201);

    const admin = await lenderSession(first.organizationId, Role.lender_admin);
    const viewer = await lenderSession(first.organizationId, Role.lender_viewer);
    expect((await as(admin).get('/lender/submissions').expect(200)).body.items).toEqual([]);
    await as(admin).get(`/lender/submissions/${requested.body.id}`).expect(404);

    expect((await as(ops).post(`/ops/submissions/${requested.body.id}/approve`).expect(403)).body.code).toBe('CONSENT_REQUIRED');
    await as(borrower).post(`/applications/${application.id}/consents`, { templateVersionId, items: [{ purpose: 'lender_sharing', granted: true, organizationIds: [first.organizationId] }] }).expect(200);
    const missing = await as(ops).post(`/ops/submissions/${requested.body.id}/approve`).expect(400);
    expect(missing.body.details.map((issue: { code: string }) => issue.code)).toEqual(['documents_missing', 'documents_missing']);
    const udyam = await upload(borrower, { applicationId: application.id }, 'udyam_certificate', false);
    await upload(borrower, { applicationId: application.id }, 'bank_statement');
    expect((await as(ops).post(`/ops/submissions/${requested.body.id}/approve`).expect(400)).body.details.map((issue: { code: string }) => issue.code)).toEqual(['documents_not_ready']);
    expect(await scan(udyam)).toBe('clean');
    const approved = await as(ops).post(`/ops/submissions/${requested.body.id}/approve`, { note: 'File checked' }).expect(200);
    expect(approved.body.status).toBe('approved');
    expect((await as(ops).post(`/ops/submissions/${rival.body.id}/approve`).expect(403)).body.code).toBe('CONSENT_REQUIRED');

    expect(await deliver(requested.body.id)).toMatchObject({ delivered: true });
    expect(await deliver(requested.body.id)).toMatchObject({ delivered: false });
    expect((await as(borrower).get(`/applications/${application.id}`).expect(200)).body).toMatchObject({ status: 'submitted', journeyStage: expect.any(String) });
    expect((await as(borrower).delete(`/documents/${udyam}`).expect(409)).body.code).toBe('DOCUMENT_LOCKED');

    const inbox = await as(admin).get('/lender/submissions').expect(200);
    expect(inbox.body.items.map((item: { id: string }) => item.id)).toEqual([requested.body.id]);
    const detail = await as(admin).get(`/lender/submissions/${requested.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ status: 'sent_to_lender', packet: { content: { borrower: { name: 'Mehta Garments' }, application: { amountPaise: 20 * LAKH, tenureMonths: 36 } } } });
    expect(detail.body.documents).toHaveLength(2);
    expect((await as(admin).get(`/lender/submissions/${requested.body.id}/documents/${udyam}/download-url`).expect(200)).body.url).toBeTruthy();
    await as(admin).get(`/lender/submissions/${requested.body.id}/documents/${rival.body.id}/download-url`).expect(404);
    await as(viewer).post(`/lender/submissions/${requested.body.id}/events`, { action: 'acknowledge' }).expect(403);
    await as(admin).get(`/lender/submissions/${rival.body.id}`).expect(404);

    const acknowledged = await as(admin).post(`/lender/submissions/${requested.body.id}/events`, { action: 'acknowledge', lenderReference: 'FF/2026/101' }).expect(200);
    expect(acknowledged.body).toMatchObject({ status: 'under_review', lenderReference: 'FF/2026/101' });
    const asked = await as(admin).post(`/lender/submissions/${requested.body.id}/document-requests`, { documentTypes: ['itr'], note: 'Latest ITR please', dueInDays: 7 }).expect(201);
    expect(asked.body).toMatchObject({ status: 'open', documentTypes: [{ key: 'itr', label: 'Income Tax Return' }] });
    expect((await as(borrower).get(`/applications/${application.id}/submissions/${requested.body.id}`).expect(200)).body.status).toBe('query_raised');
    const openRequests = await as(borrower).get(`/applications/${application.id}/document-requests`).expect(200);
    expect(openRequests.body.items.map((item: { id: string; status: string }) => [item.id, item.status])).toEqual([[asked.body.id, 'open']]);
    const itr = await upload(borrower, { applicationId: application.id }, 'itr');
    const document = await t.prisma.document.findUniqueOrThrow({ where: { id: itr } });
    expect(await inCls(() => service().onDocumentScanned({ partyId: document.partyId, borrowerProfileId: document.borrowerProfileId, applicationId: document.applicationId }))).toBe(1);
    const answered = await as(admin).get(`/lender/submissions/${requested.body.id}`).expect(200);
    expect(answered.body).toMatchObject({ status: 'under_review', documentRequests: [{ status: 'fulfilled', fulfilledDocumentIds: [itr] }] });
    expect(answered.body.documents.map((item: { id: string }) => item.id)).toContain(itr);

    const letter = await upload(admin, { submissionId: requested.body.id }, 'sanction_letter');
    const sanctioned = await as(admin).post(`/lender/submissions/${requested.body.id}/events`, { action: 'sanction', amountPaise: 15 * LAKH, evidenceDocumentId: letter }).expect(200);
    expect(sanctioned.body).toMatchObject({ status: 'sanctioned', sanction: { amountPaise: 15 * LAKH, letterDocumentId: letter } });
    expect((await as(borrower).get(`/documents/${letter}`).expect(200)).body.applicationId).toBe(application.id);

    await expect(inCls(() => service().act(requested.body.id, { action: 'disburse', amountPaise: LAKH, note: 'Bot entry', evidenceDocumentId: letter }, SubmissionChannel.Ops, systemAbility(), 'en'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await as(ops).post(`/ops/submissions/${requested.body.id}/events`, { action: 'disburse', amountPaise: 10 * LAKH, note: 'Lender email' }).expect(400);
    const partial = await as(admin).post(`/lender/submissions/${requested.body.id}/events`, { action: 'disburse', amountPaise: 10 * LAKH }).expect(200);
    expect(partial.body).toMatchObject({ status: 'disbursed', disbursal: { amountPaise: 10 * LAKH } });
    expect((await as(admin).post(`/lender/submissions/${requested.body.id}/events`, { action: 'disburse', amountPaise: 6 * LAKH }).expect(400)).body.details[0].code).toBe('exceeds_sanction');
    const advice = await upload(ops, { submissionId: requested.body.id }, 'disbursement_advice');
    const full = await as(ops).post(`/ops/submissions/${requested.body.id}/events`, { action: 'disburse', amountPaise: 5 * LAKH, note: 'Second tranche confirmed by lender email', evidenceDocumentId: advice }).expect(200);
    expect(full.body.disbursal.amountPaise).toBe(15 * LAKH);
    const won = await as(borrower).get(`/applications/${application.id}`).expect(200);
    expect(won.body).toMatchObject({ status: 'closed_won', closeReason: 'disbursed' });

    const timeline = await as(borrower).get(`/applications/${application.id}/submissions/${requested.body.id}`).expect(200);
    expect(timeline.body.events.map((event: { type: string }) => event.type)).toEqual(['requested', 'approved', 'sent', 'acknowledged', 'query_raised', 'query_answered', 'sanctioned', 'disbursed', 'disbursed']);
    const queue = await as(ops).get('/ops/submissions').query({ status: 'disbursed' }).expect(200);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(requested.body.id);
    expect((await as(borrower).get(`/applications/${application.id}/submissions`).expect(200)).body.items).toHaveLength(2);
  });

  it('records the lender-scoped sharing consent when the borrower shares while applying', async () => {
    const sharer = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const application = await assessedApplication('Mehta Exports', sharer);
    const requested = await as(sharer).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(first.id), shareWithLender: true }).expect(201);
    const approval = await as(ops).post(`/ops/submissions/${requested.body.id}/approve`).expect(400);
    expect(approval.body.details.map((issue: { code: string }) => issue.code)).toEqual(['documents_missing', 'documents_missing']);
    await as(sharer).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(second.id), shareWithLender: false }).expect(400);
  });

  it('closes the application as lost when every lender declines, withdraws on application withdrawal and assigns cases', async () => {
    const application = await assessedApplication('Mehta Exports');
    await as(borrower).post(`/applications/${application.id}/consents`, { templateVersionId, items: [{ purpose: 'lender_sharing', granted: true, organizationIds: [first.organizationId, second.organizationId] }] }).expect(200);
    await upload(borrower, { applicationId: application.id }, 'udyam_certificate');
    await upload(borrower, { applicationId: application.id }, 'bank_statement');
    const ids: string[] = [];
    for (const lender of lenders) {
      const created = await as(borrower).post(`/applications/${application.id}/submissions`, { matchResultId: application.results.get(lender.id) }).expect(201);
      await as(ops).post(`/ops/submissions/${created.body.id}/approve`).expect(200);
      expect(await deliver(created.body.id)).toMatchObject({ delivered: true });
      ids.push(created.body.id);
    }
    const admin = await lenderSession(second.organizationId, Role.lender_credit_officer);
    const rejected = await as(admin).post(`/lender/submissions/${ids[1]}/events`, { action: 'reject', reason: 'credit_history', note: 'Two recent defaults' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', rejection: { reason: 'credit_history', label: 'Credit history', note: 'Two recent defaults' } });
    const seen = await as(borrower).get(`/applications/${application.id}/submissions/${ids[1]}`).expect(200);
    expect(seen.body.rejection).toEqual({ reason: 'credit_history', label: 'Credit history' });
    expect((await as(borrower).get(`/applications/${application.id}`).expect(200)).body.status).toBe('submitted');
    await as(ops).post(`/ops/submissions/${ids[0]}/events`, { action: 'reject', reason: 'policy_mismatch' }).expect(400);
    await as(ops).post(`/ops/submissions/${ids[0]}/events`, { action: 'reject', reason: 'policy_mismatch', note: 'Lender declined on call' }).expect(200);
    expect((await as(borrower).get(`/applications/${application.id}`).expect(200)).body).toMatchObject({ status: 'closed_lost', closeReason: 'all_lenders_declined' });

    const other = await assessedApplication('Mehta Retail');
    const pending = await as(borrower).post(`/applications/${other.id}/submissions`, { matchResultId: other.results.get(first.id) }).expect(201);
    const requested = await as(ops).post(`/ops/cases/${other.id}/document-requests`, { documentTypes: ['gstr_3b'] }).expect(201);
    expect(requested.body).toMatchObject({ submissionId: null, status: 'open', requestedContext: 'staff' });
    await as(borrower).post(`/applications/${other.id}/withdraw`, { reason: 'Found funds elsewhere' }).expect(200);
    expect(await inCls(() => service().onApplicationClosed(other.id, 'withdrawn'))).toBe(1);
    expect((await as(borrower).get(`/applications/${other.id}/submissions/${pending.body.id}`).expect(200)).body).toMatchObject({ status: 'withdrawn', withdrawnReason: 'application_withdrawn' });

    const stranger = await otpLogin(t, randomMobile(), LoginAs.borrower);
    await as(stranger).get(`/applications/${application.id}/submissions`).expect(404);
    const reviewer = await createStaffSession(t, Role.ops_reviewer, 'Gauri Sen');
    const assigned = await as(ops).post(`/ops/cases/${application.id}/assign`, { assigneeUserId: reviewer.user.id }).expect(200);
    expect(assigned.body.assigneeUserId).toBe(reviewer.user.id);
    expect((await as(ops).post(`/ops/cases/${application.id}/assign`, { assigneeUserId: borrower.user.id }).expect(400)).body.details[0].code).toBe('not_an_assignee');
    expect((await as(borrower).get(`/applications/${other.id}/document-requests`).expect(200)).body.items).toEqual([expect.objectContaining({ id: requested.body.id, status: 'cancelled' })]);
    await as(ops).post(`/ops/cases/${other.id}/document-requests`, { documentTypes: ['gstr_3b'] }).expect(409);
  });
});
