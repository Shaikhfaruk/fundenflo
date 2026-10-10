import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/infrastructure/storage/storage.port.js';
import { EICAR_TEST_STRING } from '../../src/integrations/antivirus/eicar.scanner.js';
import { ApplicationService } from '../../src/modules/applications/application/application.service.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { SlaService } from '../../src/modules/sla/application/sla.service.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, 'latin1');

describe('document upload, scanning and the application checklist', () => {
  let t: TestApp;
  let borrower: AuthResult;
  let other: AuthResult;
  let ops: StaffSession;
  let applicationId: string;
  let storage: ObjectStorage;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const scan = (id: string) => inCls(() => t.app.get(DocumentScanService).scan(id));
  const refresh = (partyId: string) => inCls(() => t.app.get(ApplicationService).refreshForParties([partyId]));

  const upload = (session: AuthResult | StaffSession, fields: Record<string, string>, file?: { body: Buffer; name: string; type: string }) => {
    const request = t.api().post('/v1/documents').set(bearer(session.accessToken));
    for (const [key, value] of Object.entries(fields)) request.field(key, value);
    return file ? request.attach('file', file.body, { filename: file.name, contentType: file.type }) : request;
  };

  const startApplication = async (session: AuthResult, businessName: string) => {
    const created = await t.api().post('/v1/applications').set(bearer(session.accessToken)).send({ segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' }).expect(201);
    await t.api().patch(`/v1/applications/${created.body.id}/requirement`).set(bearer(session.accessToken)).set('If-Match', `"${created.body.version}"`).send({ purpose: 'expansion', amountPaise: 25 * LAKH, tenureMonths: 36, city: 'Gurgaon' }).expect(200);
    await t.api().put(`/v1/applications/${created.body.id}/answers`).set(bearer(session.accessToken)).send({ answers: [{ questionKey: 'business_age', value: '1-3' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    return created.body as { id: string; party: { id: string }; actingParty: { id: string }; borrowerProfileId: string };
  };

  beforeAll(async () => {
    t = await startTestApp();
    storage = t.app.get<ObjectStorage>(OBJECT_STORAGE);
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    other = await otpLogin(t, randomMobile(), LoginAs.borrower);
    ops = await createStaffSession(t, Role.ops_lead, 'Kavita Rao');
    applicationId = (await startApplication(borrower, 'Rao Textiles')).id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('uploads a PDF, scans it and hands out a short-lived download link', async () => {
    const file = { body: pdf('Rao Textiles statement April to September'), name: 'HDFC statement.pdf', type: 'application/pdf' };
    const created = await upload(borrower, { documentType: 'bank_statement', applicationId }, file).expect(201);
    expect(created.body).toMatchObject({ status: 'uploaded', mimeType: 'application/pdf', fileName: 'HDFC statement.pdf', applicationId, documentType: { key: 'bank_statement' }, sizeBytes: file.body.length, passwordProtected: false });
    expect(created.body.freshUntil).not.toBeNull();
    const id: string = created.body.id;
    const stored = await t.prisma.document.findUniqueOrThrow({ where: { id } });
    expect(await storage.exists(stored.storageKey)).toBe(true);
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);

    expect((await t.api().get(`/v1/documents/${id}/download-url`).set(bearer(borrower.accessToken)).expect(409)).body.code).toBe('DOCUMENT_NOT_READY');
    expect(await scan(id)).toBe('clean');
    expect(await scan(id)).toBe('skipped');
    expect((await t.api().get(`/v1/documents/${id}`).set(bearer(borrower.accessToken)).expect(200)).body).toMatchObject({ status: 'scanned' });

    const link = await t.api().get(`/v1/documents/${id}/download-url`).set(bearer(ops.accessToken)).expect(200);
    const downloaded = await fetch(link.body.url);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(file.body)).toBe(true);
    expect(new Date(link.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    expect(await t.prisma.auditEvent.count({ where: { entityId: id, action: 'document.download_url_issued' } })).toBe(1);

    const again = await upload(borrower, { documentType: 'bank_statement', applicationId }, file).expect(201);
    expect(again.body.id).toBe(id);
    expect(await t.prisma.document.count({ where: { applicationId } })).toBe(1);

    const listed = await t.api().get('/v1/documents').query({ applicationId }).set(bearer(borrower.accessToken)).expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await t.api().get('/v1/documents').set(bearer(other.accessToken)).expect(200)).body.items).toEqual([]);
    await t.api().get(`/v1/documents/${id}`).set(bearer(other.accessToken)).expect(404);
    await t.api().get(`/v1/documents/${id}/download-url`).set(bearer(other.accessToken)).expect(404);
    await upload(other, { documentType: 'bank_statement', applicationId }, file).expect(404);
  });

  it('refuses missing fields, renamed executables, unaccepted types and files over the type limit', async () => {
    const before = await t.prisma.document.count();
    const missing = await upload(borrower, { applicationId }, { body: pdf('x'), name: 'a.pdf', type: 'application/pdf' }).expect(400);
    expect(missing.body.details[0].path).toBe('documentType');
    const both = await upload(borrower, { documentType: 'itr', applicationId, borrowerProfileId: applicationId }, { body: pdf('x'), name: 'a.pdf', type: 'application/pdf' }).expect(400);
    expect(both.body.details[0].path).toBe('applicationId');
    expect((await upload(borrower, { documentType: 'itr', applicationId }).expect(400)).body.details[0]).toMatchObject({ path: 'file', code: 'required' });
    expect((await upload(borrower, { documentType: 'no_such_type', applicationId }, { body: pdf('x'), name: 'a.pdf', type: 'application/pdf' }).expect(400)).body.details[0].code).toBe('unknown_key');

    const renamed = await upload(borrower, { documentType: 'itr', applicationId }, { body: Buffer.from('MZ\u0090\u0000 this is a program', 'latin1'), name: 'itr.pdf', type: 'application/pdf' }).expect(415);
    expect(renamed.body).toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED', details: { detected: null } });
    const csv = await upload(borrower, { documentType: 'itr', applicationId }, { body: Buffer.from('year,income\n2025,1200000\n'), name: 'itr.csv', type: 'text/csv' }).expect(415);
    expect(csv.body.details).toMatchObject({ detected: 'text/csv', accepted: ['application/pdf', 'image/jpeg', 'image/png'] });

    const tiny = await t.api().post('/v1/admin/document-types').set(bearer(ops.accessToken)).send({ key: 'tiny_proof', label: { en: 'Tiny Proof' }, acceptedMimeTypes: ['application/pdf'], maxSizeBytes: 64, sensitivity: 'financial' }).expect(201);
    const large = await upload(borrower, { documentType: tiny.body.key, applicationId }, { body: pdf('x'.repeat(200)), name: 'big.pdf', type: 'application/pdf' }).expect(413);
    expect(large.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', details: { maxSizeBytes: 64 } });
    expect(await t.prisma.document.count()).toBe(before);
  });

  it('rejects an infected file, removes it from storage and never serves it', async () => {
    const created = await upload(borrower, { documentType: 'itr', applicationId }, { body: pdf(EICAR_TEST_STRING), name: 'itr.pdf', type: 'application/pdf' }).expect(201);
    expect(await scan(created.body.id)).toBe('infected');
    const rejected = await t.api().get(`/v1/documents/${created.body.id}`).set(bearer(borrower.accessToken)).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', rejectReason: 'infected' });
    const stored = await t.prisma.document.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored).toMatchObject({ scanSignature: 'Eicar-Test-Signature', scanEngine: 'eicar-test' });
    expect(stored.storageDeletedAt).not.toBeNull();
    expect(await storage.exists(stored.storageKey)).toBe(false);
    await t.api().get(`/v1/documents/${created.body.id}/download-url`).set(bearer(ops.accessToken)).expect(409);
  });

  it('satisfies the checklist from application and profile documents and moves the case to documents_pending', async () => {
    const application = await startApplication(other, 'Sharma Dairy');
    const template = await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200);
    await t.api().post('/v1/me/consents').set(bearer(other.accessToken)).send({ templateVersionId: template.body.versionId, items: [{ purpose: 'ai_documents', granted: true }, { purpose: 'credit_bureau', granted: true }, { purpose: 'lender_sharing', granted: true }] }).expect(201);
    expect(await refresh(application.actingParty.id)).toBeGreaterThanOrEqual(1);
    expect((await t.api().get(`/v1/applications/${application.id}`).set(bearer(other.accessToken)).expect(200)).body).toMatchObject({ status: 'documents_pending', journeyStage: 'documents' });

    const statement = await upload(other, { documentType: 'bank_statement', borrowerProfileId: application.borrowerProfileId, password: 'SHAR1985' }, { body: pdf('Sharma Dairy statement'), name: 'statement.pdf', type: 'application/pdf' }).expect(201);
    expect(statement.body).toMatchObject({ applicationId: null, passwordProtected: true });
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: statement.body.id } })).passwordEnc).toMatch(/^v1:/);
    const itr = await upload(other, { documentType: 'itr', applicationId: application.id }, { body: pdf('Sharma Dairy ITR'), name: 'itr.pdf', type: 'application/pdf' }).expect(201);
    await refresh(application.party.id);

    const checklist = await t.api().get(`/v1/applications/${application.id}/document-checklist`).set(bearer(other.accessToken)).expect(200);
    expect(checklist.body.items.map((item: { key: string; satisfied: boolean }) => [item.key, item.satisfied])).toEqual([['bank_statement', true], ['income_proof', true]]);
    expect(checklist.body.items[1].documents).toEqual([expect.objectContaining({ id: itr.body.id, documentType: 'itr', status: 'uploaded' })]);
    const step = await t.api().get(`/v1/applications/${application.id}/next-step`).set(bearer(other.accessToken)).expect(200);
    expect(step.body).toMatchObject({ stage: 'verify_details', blockers: [{ code: 'details_unverified' }] });
    expect((await t.api().get(`/v1/applications/${application.id}`).set(bearer(other.accessToken)).expect(200)).body.journeyStage).toBe('verify_details');

    await t.prisma.document.update({ where: { id: itr.body.id }, data: { lockedAt: new Date() } });
    expect((await t.api().delete(`/v1/documents/${itr.body.id}`).set(bearer(other.accessToken)).expect(409)).body.code).toBe('DOCUMENT_LOCKED');
    await t.api().delete(`/v1/documents/${statement.body.id}`).set(bearer(other.accessToken)).expect(204);
    await t.api().delete(`/v1/documents/${statement.body.id}`).set(bearer(other.accessToken)).expect(409);
    const removed = await t.prisma.document.findUniqueOrThrow({ where: { id: statement.body.id } });
    expect(removed).toMatchObject({ status: 'deleted', deletedByUserId: other.user.id });
    expect(await storage.exists(removed.storageKey)).toBe(false);
    expect((await t.api().get(`/v1/applications/${application.id}/next-step`).set(bearer(other.accessToken)).expect(200)).body.blockers[0]).toMatchObject({ code: 'documents_missing', details: ['bank_statement'] });
    expect((await t.api().get('/v1/documents').query({ borrowerProfileId: application.borrowerProfileId }).set(bearer(other.accessToken)).expect(200)).body.items).toHaveLength(1);
  });

  it('re-queues a scan that is overdue and gives up after the attempt limit', async () => {
    const created = await upload(borrower, { documentType: 'gstr_3b', applicationId }, { body: pdf('GSTR-3B'), name: 'gst.pdf', type: 'application/pdf' }).expect(201);
    const id: string = created.body.id;
    const overdue = async () => {
      await t.prisma.slaTimer.updateMany({ where: { entityId: id, kind: 'document_scan', status: 'pending' }, data: { dueAt: new Date(Date.now() - 1_000) } });
      await inCls(() => t.app.get(SlaService).sweep());
    };
    await overdue();
    expect(await t.prisma.outboxEvent.count({ where: { aggregateId: id, eventName: 'document.scan_overdue' } })).toBe(1);
    expect(await t.prisma.slaTimer.count({ where: { entityId: id, kind: 'document_scan', status: 'pending' } })).toBe(1);

    await t.prisma.document.update({ where: { id }, data: { scanAttempts: 6 } });
    await overdue();
    expect(await t.prisma.outboxEvent.count({ where: { aggregateId: id, eventName: 'document.scan_overdue' } })).toBe(1);
    expect(await t.prisma.auditEvent.count({ where: { entityId: id, action: 'document.scan_overdue' } })).toBe(2);
    expect(await t.prisma.slaTimer.count({ where: { entityId: id, kind: 'document_scan', status: 'pending' } })).toBe(0);
    expect(await scan(id)).toBe('clean');
  });
});
