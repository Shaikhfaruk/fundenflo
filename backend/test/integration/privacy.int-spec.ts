import type { Readable } from 'node:stream';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/infrastructure/storage/storage.port.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { DataRequestService } from '../../src/modules/privacy/application/data-request.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const readAll = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
};

describe('data principal rights: access export, correction and erasure', () => {
  let t: TestApp;
  let compliance: StaffSession;
  let support: StaffSession;
  let ops: StaffSession;
  let templateVersionId: string;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>) => t.api().put(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  const journey = async (mobile: string) => {
    const borrower = await otpLogin(t, mobile, LoginAs.borrower);
    const created = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Gupta Bakers', category: 'business' }).expect(201);
    await as(borrower).patch(`/applications/${created.body.id}/requirement`, { purpose: 'expansion', amountPaise: 10 * LAKH, tenureMonths: 24, city: 'Gurgaon' }, created.body.version).expect(200);
    await as(borrower).put(`/applications/${created.body.id}/answers`, { answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
    await as(borrower).post(`/applications/${created.body.id}/consents`, { templateVersionId, items: [{ purpose: 'ai_documents', granted: true }, { purpose: 'credit_bureau', granted: true }] }).expect(200);
    const document = await t.api().post('/v1/documents').set(bearer(borrower.accessToken)).field('documentType', 'bank_statement').field('applicationId', created.body.id).attach('file', Buffer.from(`%PDF-1.7\n${mobile}\n%%EOF\n`), { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(await inCls(() => t.app.get(DocumentScanService).scan(document.body.id))).toBe('clean');
    return { borrower, applicationId: created.body.id as string, documentId: document.body.id as string };
  };

  beforeAll(async () => {
    t = await startTestApp();
    compliance = await createStaffSession(t, Role.compliance_officer, 'Rekha Bhat');
    support = await createStaffSession(t, Role.support, 'Imran Qureshi');
    ops = await createStaffSession(t, Role.ops_lead, 'Tara Nair');
    templateVersionId = (await t.api().get('/v1/catalog/consent-templates').query({ context: 'journey' }).expect(200)).body.versionId;
  });

  afterAll(async () => {
    await t.close();
  });

  it('builds an access export of everything held about the person and their proprietorship', async () => {
    const mobile = randomMobile();
    const { borrower, documentId } = await journey(mobile);
    const request = await as(borrower).post('/me/data-requests', { kind: 'access' }).expect(201);
    expect(request.body).toMatchObject({ kind: 'access', status: 'received', exportReady: false });
    expect(request.body.ref).toMatch(/^DR-/);
    await as(borrower).post('/me/data-requests', { kind: 'access' }).expect(409);
    await as(borrower).post('/me/data-requests', { kind: 'correction' }).expect(400);
    await as(borrower).get(`/me/data-requests/${request.body.id}/export-url`).expect(404);

    const key = await inCls(() => t.app.get(DataRequestService).buildExport(request.body.id));
    expect(key).toBe(`privacy-exports/${request.body.id}.json`);
    const mine = await as(borrower).get('/me/data-requests').expect(200);
    expect(mine.body.items[0]).toMatchObject({ status: 'completed', exportReady: true });
    expect((await as(borrower).get(`/me/data-requests/${request.body.id}/export-url`).expect(200)).body.url).toBeTruthy();
    const exported = JSON.parse(await readAll(await t.app.get<ObjectStorage>(OBJECT_STORAGE).read(key as string)));
    expect(exported.ref).toBe(request.body.ref);
    const { sections } = exported;
    expect(sections.profile.flatMap((party: { contacts: Array<{ value: string }> }) => party.contacts.map((contact) => contact.value))).toContain(`+91${mobile}`);
    expect(sections.profile.map((party: { kind: string }) => party.kind).toSorted()).toEqual(['business', 'person']);
    expect(sections.applications).toHaveLength(1);
    expect(sections.answers.map((answer: { question: string }) => answer.question)).toContain('business_age');
    expect(sections.facts.length).toBeGreaterThan(0);
    expect(sections.documents.map((document: { id: string }) => document.id)).toEqual([documentId]);
    expect(sections.consents.filter((record: { granted: boolean }) => record.granted).map((record: { purpose: string }) => record.purpose).toSorted()).toEqual(['ai_documents', 'credit_bureau']);
    expect(sections.account).toMatchObject({ status: 'active', logins: [{ method: 'mobile_otp' }] });
    expect(sections.shared_with_lenders).toEqual([]);
  });

  it('erases a person once nothing legally holds the data, and refuses while a case is open', async () => {
    const mobile = randomMobile();
    const { borrower, applicationId, documentId } = await journey(mobile);
    const request = await as(borrower).post('/me/data-requests', { kind: 'erasure', details: 'Please delete my account' }).expect(201);
    const open = await as(compliance).get(`/ops/data-requests/${request.body.id}`).expect(200);
    expect(open.body.holds).toEqual([expect.stringContaining('is still open')]);
    expect((await as(compliance).post(`/ops/data-requests/${request.body.id}/complete`, { response: 'Erased as requested' }).expect(400)).body.details[0].code).toBe('legal_hold');
    await as(support).post(`/ops/data-requests/${request.body.id}/complete`, { response: 'Erased as requested' }).expect(403);
    expect((await as(support).get('/ops/data-requests').query({ kind: 'erasure', status: 'received' }).expect(200)).body.items.map((item: { id: string }) => item.id)).toContain(request.body.id);

    await as(borrower).post(`/applications/${applicationId}/withdraw`, { reason: 'Closing my account' }).expect(200);
    expect((await as(compliance).get(`/ops/data-requests/${request.body.id}`).expect(200)).body.holds).toEqual([]);
    const party = await t.prisma.loanApplication.findUniqueOrThrow({ where: { id: applicationId }, select: { partyId: true, actingPartyId: true } });
    const done = await as(compliance).post(`/ops/data-requests/${request.body.id}/complete`, { response: 'Your personal data was erased' }).expect(200);
    expect(done.body).toMatchObject({ status: 'completed', outcome: { profile: { parties: 2 }, account: { users: 1 }, documents: { documents: 1 } } });
    expect(await t.prisma.partyContact.count({ where: { partyId: { in: [party.partyId, party.actingPartyId] } } })).toBe(0);
    expect(await t.prisma.borrowerFact.count({ where: { partyId: { in: [party.partyId, party.actingPartyId] } } })).toBe(0);
    expect(await t.prisma.answer.count({ where: { partyId: { in: [party.partyId, party.actingPartyId] } } })).toBe(0);
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: documentId } })).status).toBe('purged');
    expect((await t.prisma.party.findUniqueOrThrow({ where: { id: party.actingPartyId } })).displayName).toBeNull();
    const latest = await t.prisma.consentRecord.findFirstOrThrow({ where: { partyId: party.actingPartyId, purposeKey: 'ai_documents' }, orderBy: { recordedAt: 'desc' } });
    expect(latest.granted).toBe(false);
    expect((await t.prisma.user.findFirstOrThrow({ where: { partyId: party.actingPartyId } })).status).toBe('deleted');
    await as(borrower).get('/me').expect(401);
    const again = await otpLogin(t, mobile, LoginAs.borrower);
    expect(again.user.id).not.toBe(borrower.user.id);
  });

  it('lets compliance reject a correction and holds staff or partner people', async () => {
    const borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const correction = await as(borrower).post('/me/data-requests', { kind: 'correction', details: 'My name is spelt wrong' }).expect(201);
    const rejected = await as(compliance).post(`/ops/data-requests/${correction.body.id}/reject`, { reason: 'Name matches the verified PAN; update it from the profile screen' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', rejectedReason: 'Name matches the verified PAN; update it from the profile screen' });
    await as(compliance).post(`/ops/data-requests/${correction.body.id}/complete`, { response: 'Done' }).expect(409);

    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    const firm = await createPartnerFirm(t, { name: 'Nair Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const owner = await createPartnerSession(t, firm);
    const erasure = await as(owner).post('/me/data-requests', { kind: 'erasure' }).expect(201);
    expect((await as(compliance).get(`/ops/data-requests/${erasure.body.id}`).expect(200)).body.holds).toEqual([expect.stringContaining('partner, lender or FundenFlo')]);
  });
});
