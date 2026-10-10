import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { EventName } from '../../src/common/events/event-names.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { RiskDetectionService } from '../../src/modules/risk/application/risk-detection.service.js';
import { RiskService } from '../../src/modules/risk/application/risk.service.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXY';

const firmPan = () => `AAAF${LETTERS[randomInt(0, LETTERS.length)]}${String(randomInt(0, 10_000)).padStart(4, '0')}${LETTERS[randomInt(0, LETTERS.length)]}`;

describe('risk signals, fraud reviews and holds', () => {
  let t: TestApp;
  let ops: StaffSession;
  let reviewer: StaffSession;
  let support: StaffSession;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const detect = (name: string, payload: Record<string, unknown>) => inCls(() => t.app.get(RiskDetectionService).handle({ id: crypto.randomUUID(), name: name as never, aggregateType: 'test', aggregateId: null, payload, actor: null, requestId: null, occurredAt: new Date().toISOString() }));
  const holds = (scope: Parameters<RiskService['holds']>[0]) => inCls(() => t.app.get(RiskService).holds(scope));

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version?: number) => {
      const request = t.api().patch(`/v1${path}`).set(bearer(session.accessToken));
      return (version === undefined ? request : request.set('If-Match', `"${version}"`)).send(body);
    },
  });

  const caseWithStatement = async (businessName: string, content: Buffer) => {
    const borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const application = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' }).expect(201);
    const uploaded = await t.api().post('/v1/documents').set(bearer(borrower.accessToken)).field('documentType', 'bank_statement').field('applicationId', application.body.id).attach('file', content, { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    return { applicationId: application.body.id as string, partyId: application.body.party.id as string, documentId: uploaded.body.id as string };
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Kavya Iyer');
    reviewer = await createStaffSession(t, Role.ops_reviewer, 'Manoj Pillai');
    support = await createStaffSession(t, Role.support, 'Lata Sinha');
  });

  afterAll(async () => {
    await t.close();
  });

  it('flags the same file uploaded by two people, holds the case and lets a reviewer clear it', async () => {
    const content = Buffer.from(`%PDF-1.7\nstatement ${randomInt(0, 1_000_000_000)}\n%%EOF\n`);
    const first = await caseWithStatement('Iyer Textiles', content);
    expect(await detect(EventName.DocumentScanned, { documentId: first.documentId })).toBe(0);
    const second = await caseWithStatement('Pillai Traders', content);
    expect(await detect(EventName.DocumentScanned, { documentId: second.documentId })).toBe(1);
    expect(await detect(EventName.DocumentScanned, { documentId: second.documentId })).toBe(0);

    const signals = await as(reviewer).get('/ops/risk-signals').query({ applicationId: second.applicationId }).expect(200);
    expect(signals.body.items).toEqual([expect.objectContaining({ kind: 'document_reuse', severity: 'high', status: 'open', ruleKey: 'document.same_file_other_party', subject: { type: 'application', id: second.applicationId }, evidence: { documentId: second.documentId, documentType: 'bank_statement', otherParties: 1 } })]);
    const reviewId = signals.body.items[0].reviewId as string;
    expect(await holds({ applicationId: second.applicationId })).toEqual([expect.objectContaining({ reviewId, status: 'open', highestSeverity: 'high' })]);
    await expect(inCls(() => t.app.get(RiskService).assertClear({ applicationId: second.applicationId }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect((await as(ops).get('/ops/fraud-reviews').query({ status: 'open' }).expect(200)).body.items.map((item: { id: string }) => item.id)).toContain(reviewId);
    const review = await as(reviewer).get(`/ops/fraud-reviews/${reviewId}`).expect(200);
    expect(review.body).toMatchObject({ status: 'open', subject: { type: 'application', id: second.applicationId }, signals: [{ kind: 'document_reuse' }] });
    await as(support).post(`/ops/fraud-reviews/${reviewId}/decision`, { decision: 'cleared', note: 'Statement belongs to the business partner' }).expect(403);
    await as(reviewer).post(`/ops/fraud-reviews/${reviewId}/decision`, { decision: 'cleared', note: 'short' }).expect(400);
    const cleared = await as(reviewer).post(`/ops/fraud-reviews/${reviewId}/decision`, { decision: 'cleared', note: 'Both firms are run by the same family; documents verified with the bank' }).expect(200);
    expect(cleared.body).toMatchObject({ status: 'decided', decision: 'cleared', signals: [{ status: 'dismissed' }] });
    expect(await holds({ applicationId: second.applicationId })).toEqual([]);
    await as(reviewer).post(`/ops/fraud-reviews/${reviewId}/decision`, { decision: 'confirmed', note: 'Changed my mind on this case' }).expect(409);
  });

  it('raises consistency, identity and shared-bank signals and keeps confirmed fraud on hold', async () => {
    const partyId = (await caseWithStatement('Sinha Exports', Buffer.from(`%PDF-1.7\n${randomInt(0, 1_000_000_000)}\n%%EOF\n`))).partyId;
    expect(await detect(EventName.ConsistencySignalRaised, { signalId: crypto.randomUUID(), partyId, applicationId: null, attributeKey: 'business.monthly_turnover_paise', severity: 'medium' })).toBe(1);
    expect(await holds({ partyIds: [partyId] })).toEqual([]);
    expect(await detect(EventName.ConsistencySignalRaised, { signalId: crypto.randomUUID(), partyId, applicationId: null, attributeKey: 'business.gst_turnover_paise', severity: 'high' })).toBe(1);
    expect(await detect(EventName.BorrowerProfileChanged, { borrowerProfileId: crypto.randomUUID(), partyId, kyc: 'pan', nameMatch: false })).toBe(1);
    expect(await detect(EventName.BorrowerProfileChanged, { borrowerProfileId: crypto.randomUUID(), partyId, kyc: 'pan', nameMatch: true })).toBe(0);
    const party = await as(ops).get('/ops/risk-signals').query({ partyId }).expect(200);
    expect(party.body.items.map((item: { kind: string; severity: string }) => [item.kind, item.severity]).toSorted()).toEqual([['gst_itr_mismatch', 'high'], ['identity_mismatch', 'medium'], ['inflow_mismatch', 'medium']]);
    expect(new Set(party.body.items.map((item: { reviewId: string }) => item.reviewId)).size).toBe(1);
    expect(await holds({ partyIds: [partyId] })).toHaveLength(1);

    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    const firmA = await createPartnerFirm(t, { name: 'Iyer Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const firmB = await createPartnerFirm(t, { name: 'Pillai Advisors', cityId: gurugramId, signedUpByUserId: ops.user.id });
    const bankAccount = { accountNumber: `50200${randomInt(100_000_000, 999_999_999)}`, ifsc: 'HDFC0009999', holderName: 'Shared Holder' };
    await as(await createPartnerSession(t, firmA)).patch('/partner/profile', { pan: firmPan(), bankAccount }).expect(200);
    await as(await createPartnerSession(t, firmB)).patch('/partner/profile', { pan: firmPan(), bankAccount }).expect(200);
    expect(await detect(EventName.PartnerKycUpdated, { organizationId: firmB })).toBe(1);
    const shared = await as(ops).get('/ops/risk-signals').query({ kind: 'duplicate_identity', status: 'open' }).expect(200);
    const signal = shared.body.items.find((item: { organizationId: string }) => item.organizationId === firmB);
    expect(signal).toMatchObject({ severity: 'high', evidence: { sharedWithOrganizationIds: [firmA] } });
    await expect(inCls(() => t.app.get(RiskService).assertClear({ organizationIds: [firmB] }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await as(ops).post(`/ops/fraud-reviews/${signal.reviewId}/decision`, { decision: 'confirmed', note: 'Both firms are fronts for the same agent' }).expect(200);
    expect(await holds({ organizationIds: [firmB] })).toEqual([expect.objectContaining({ status: 'decided', decision: 'confirmed' })]);
    expect((await as(ops).get('/ops/risk-signals').query({ kind: 'duplicate_identity', status: 'confirmed' }).expect(200)).body.items.map((item: { id: string }) => item.id)).toContain(signal.id);
  });
});
