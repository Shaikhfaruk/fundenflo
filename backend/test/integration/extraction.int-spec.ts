import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { ExtractionService } from '../../src/modules/documents/application/extraction.service.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const allGranted = [
  { purpose: 'ai_documents', granted: true },
  { purpose: 'credit_bureau', granted: true },
  { purpose: 'lender_sharing', granted: true },
];

const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, 'latin1');

describe('document extraction, ops review and consistency signals', () => {
  let t: TestApp;
  let ops: StaffSession;
  let templateVersionId: string;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const scan = (id: string) => inCls(() => t.app.get(DocumentScanService).scan(id));
  const extract = (id: string) => inCls(() => t.app.get(ExtractionService).extract(id));

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string, query: Record<string, string> = {}) => t.api().get(`/v1${path}`).query(query).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
  });

  const caseWithStatement = async (consent: boolean) => {
    const borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const created = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: `Shop ${randomMobile()}`, category: 'business' }).expect(201);
    await t.api().patch(`/v1/applications/${created.body.id}/requirement`).set(bearer(borrower.accessToken)).set('If-Match', `"${created.body.version}"`).send({ purpose: 'expansion', amountPaise: 25 * LAKH, tenureMonths: 36, city: 'Gurgaon' }).expect(200);
    await t.api().put(`/v1/applications/${created.body.id}/answers`).set(bearer(borrower.accessToken)).send({ answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    if (consent) await as(borrower).post(`/applications/${created.body.id}/consents`, { templateVersionId, items: allGranted }).expect(200);
    const document = await t.api().post('/v1/documents').set(bearer(borrower.accessToken)).field('documentType', 'bank_statement').field('applicationId', created.body.id).attach('file', pdf('statement'), { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    await scan(document.body.id);
    return { borrower, applicationId: created.body.id as string, actingPartyId: created.body.actingParty.id as string, partyId: created.body.party.id as string, documentId: document.body.id as string };
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Ritu Malhotra');
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
  });

  afterAll(async () => {
    await t.close();
  });

  it('waits for AI consent, then sends scanned documents to ops keying with the manual extractor', async () => {
    const pending = await caseWithStatement(false);
    expect(await extract(pending.documentId)).toBe('no_consent');
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: pending.documentId } })).status).toBe('scanned');
    await as(pending.borrower).post(`/applications/${pending.applicationId}/consents`, { templateVersionId, items: allGranted }).expect(200);
    expect(await inCls(() => t.app.get(ExtractionService).extractPending(pending.actingPartyId))).toBe(1);
    expect((await as(pending.borrower).get(`/documents/${pending.documentId}`).expect(200)).body.status).toBe('needs_review');

    const extractions = await as(ops).get(`/ops/documents/${pending.documentId}/extractions`).expect(200);
    expect(extractions.body.items).toEqual([expect.objectContaining({ extractor: 'manual', status: 'needs_review', reason: 'manual_keying', fields: [] })]);
    const queue = await as(ops).get('/documents', { status: 'needs_review' }).expect(200);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(pending.documentId);
    expect(await extract(pending.documentId)).toBe('skipped');
  });

  it('records what ops key in as verified facts and raises a signal when it contradicts the borrower', async () => {
    const reviewed = await caseWithStatement(true);
    expect(await extract(reviewed.documentId)).toBe('needs_review');
    await as(ops).post(`/ops/documents/${reviewed.documentId}/review`, { outcome: 'verified', fields: [{ attributeKey: 'business.monthly_turnover_paise', value: 'lots' }] }).expect(400);
    const verified = await as(ops).post(`/ops/documents/${reviewed.documentId}/review`, { outcome: 'verified', fields: [{ attributeKey: 'business.monthly_turnover_paise', value: 40 * LAKH }], note: 'Average credits over six months' }).expect(200);
    expect(verified.body.status).toBe('verified');
    const fact = await t.prisma.borrowerFact.findFirstOrThrow({ where: { partyId: reviewed.partyId, attributeKey: 'business.monthly_turnover_paise', provenance: 'ops_verified' } });
    expect(fact.sourceType).toBe('document_extraction');

    const signals = await as(ops).get('/ops/consistency-signals', { status: 'open', applicationId: reviewed.applicationId }).expect(200);
    expect(signals.body.items).toEqual([expect.objectContaining({ attributeKey: 'business.monthly_turnover_paise', observedProvenance: 'ops_verified', observedValue: 40 * LAKH, deviationPct: 60, severity: 'medium' })]);
    const resolved = await as(ops).post(`/ops/consistency-signals/${signals.body.items[0].id}/resolve`, { status: 'resolved', note: 'Seasonal sales; borrower confirmed on call' }).expect(200);
    expect(resolved.body).toMatchObject({ status: 'resolved', resolutionNote: 'Seasonal sales; borrower confirmed on call' });
    await as(ops).post(`/ops/consistency-signals/${signals.body.items[0].id}/resolve`, { status: 'dismissed', note: 'Again' }).expect(409);
    await as(ops).post(`/ops/documents/${reviewed.documentId}/review`, { outcome: 'verified', fields: [] }).expect(409);

    const analysis = await as(reviewed.borrower).post(`/applications/${reviewed.applicationId}/analyses`).expect(202);
    expect(analysis.body.steps.map((step: { id: string }) => step.id)).toEqual(['documents', 'consistency', 'score']);
  });

  it('rejects a wrong document with a reason, which reopens the checklist slot', async () => {
    const wrong = await caseWithStatement(true);
    await extract(wrong.documentId);
    await as(ops).post(`/ops/documents/${wrong.documentId}/review`, { outcome: 'rejected' }).expect(400);
    const rejected = await as(ops).post(`/ops/documents/${wrong.documentId}/review`, { outcome: 'rejected', rejectReason: 'wrong_document', note: 'This is a salary slip' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', rejectReason: 'wrong_document', rejectNote: 'This is a salary slip' });
    const checklist = await as(wrong.borrower).get(`/applications/${wrong.applicationId}/document-checklist`).expect(200);
    expect(checklist.body.items.find((item: { key: string }) => item.key === 'bank_statement').satisfied).toBe(false);
    const support = await createStaffSession(t, Role.support, 'Ishaan Roy');
    await as(support).post(`/ops/documents/${wrong.documentId}/review`, { outcome: 'verified' }).expect(403);
  });
});
