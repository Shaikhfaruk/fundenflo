import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, PartnerKind, PartnerVerificationStatus, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { ReferralSignupService } from '../../src/modules/leads/application/referral-signup.service.js';
import { bearer, createOrganization, createPartnerFirm, createPartnerSession, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXY';

const firmPan = () => `AAAF${LETTERS[randomInt(0, LETTERS.length)]}${String(randomInt(0, 10_000)).padStart(4, '0')}${LETTERS[randomInt(0, LETTERS.length)]}`;

describe('partner referral codes, signup attribution, disputes and partner KYC', () => {
  let t: TestApp;
  let ops: StaffSession;
  let firmA: string;
  let firmB: string;
  let ownerA: AuthResult;
  let ownerB: AuthResult;
  let agentA: AuthResult;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).send(body),
  });

  const signUp = async (referralCode: string) => {
    const mobile = randomMobile();
    await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', referralCode }).expect(200);
    const verified = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE }).expect(200);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: verified.body.user.id } });
    expect(user.signupReferralCode).toBe(referralCode);
    return { mobile, partyId: user.partyId, userId: user.id };
  };

  const attribute = (partyId: string, referralCode: string) => t.app.get(ClsService).run(() => t.app.get(ReferralSignupService).onSignedUp({ partyId, loginAs: LoginAs.borrower, referralCode }));

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Neha Kulkarni');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firmA = await createPartnerFirm(t, { name: 'Kulkarni Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    firmB = await createPartnerFirm(t, { name: 'Bose Advisory', cityId: gurugramId, signedUpByUserId: ops.user.id });
    ownerA = await createPartnerSession(t, firmA);
    ownerB = await createPartnerSession(t, firmB);
    agentA = await createPartnerSession(t, firmA, Role.partner_agent);
  });

  afterAll(async () => {
    await t.close();
  });

  it('issues firm and member referral codes and attributes a borrower who signs up with one', async () => {
    const codes = await as(ownerA).get('/partner/referral-codes').expect(200);
    expect(codes.body.available).toBe(true);
    expect(codes.body.items.map((item: { scope: string }) => item.scope)).toEqual(['firm', 'member']);
    const firmCode = codes.body.items[0].code as string;
    expect(firmCode).toMatch(/^[A-Z0-9]{8}$/);
    expect((await as(ownerA).get('/partner/referral-codes').expect(200)).body.items[0].code).toBe(firmCode);

    const pending = await createOrganization(t, 'partner', 'Pending Partners');
    await t.prisma.partnerProfile.create({ data: { organizationId: pending.id, kind: PartnerKind.dsa, verificationStatus: PartnerVerificationStatus.pending, segments: [], categories: [], languages: [], signedUpByUserId: ops.user.id } });
    const pendingOwner = await createPartnerSession(t, pending.id);
    expect((await as(pendingOwner).get('/partner/referral-codes').expect(200)).body).toEqual({ available: false, items: [] });

    const borrower = await signUp(firmCode);
    expect(await attribute(borrower.partyId, firmCode)).toMatchObject({ outcome: 'attributed' });
    expect(await attribute(borrower.partyId, firmCode)).toMatchObject({ outcome: 'already_attributed' });
    const lead = await t.prisma.lead.findFirstOrThrow({ where: { partyId: borrower.partyId }, include: { attribution: true, source: true } });
    expect(lead.source.key).toBe('referral_code');
    expect(lead.attribution).toMatchObject({ organizationId: firmA, kind: 'referral_code', referralCodeId: codes.body.items[0].id });
    const referrals = await as(ownerA).get('/partner/referrals').expect(200);
    expect(referrals.body.items.map((item: { lead: { id: string } }) => item.lead.id)).toContain(lead.id);
    expect(await attribute(borrower.partyId, 'NOSUCHCODE')).toBeNull();
  });

  it('turns a competing claim into a dispute that ops resolve by transfer or void', async () => {
    const mobile = randomMobile();
    await as(ownerA).post('/partner/leads', { mobile, name: 'Rakesh Bose', segment: 'msme', requestConsent: false }).expect(201);
    const codeB = (await as(ownerB).get('/partner/referral-codes').expect(200)).body.items[0].code as string;
    await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', referralCode: codeB }).expect(200);
    const verified = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE }).expect(200);
    const partyId = (await t.prisma.user.findUniqueOrThrow({ where: { id: verified.body.user.id } })).partyId;
    const disputed = await attribute(partyId, codeB);
    expect(disputed).toMatchObject({ outcome: 'disputed' });

    const open = await as(ops).get('/ops/attribution-disputes').query({ status: 'open' }).expect(200);
    const dispute = open.body.items.find((item: { id: string }) => item.id === (disputed as { disputeId: string }).disputeId);
    expect(dispute).toMatchObject({ source: 'signup_code', holderOrganizationId: firmA, claimantOrganizationId: firmB, status: 'open', attribution: { organizationId: firmA } });
    expect(dispute.attribution.disputedAt).not.toBeNull();
    const claimed = await as(ownerB).post('/partner/attribution-disputes', { mobile, note: 'We introduced this borrower last month' }).expect(201);
    expect(claimed.body.id).toBe(dispute.id);
    expect((await as(ownerB).post('/partner/attribution-disputes', { mobile: randomMobile(), note: 'Nobody holds this borrower yet' }).expect(400)).body.details[0].code).toBe('not_protected');
    await as(ownerB).get('/ops/attribution-disputes').expect(403);

    const transferred = await as(ops).post(`/ops/attribution-disputes/${dispute.id}/resolve`, { outcome: 'transfer', note: 'Signed engagement letter from Bose Advisory' }).expect(200);
    expect(transferred.body).toMatchObject({ status: 'resolved', outcome: 'transfer', attribution: { organizationId: firmB, kind: 'referral_code', disputedAt: null } });
    await as(ops).post(`/ops/attribution-disputes/${dispute.id}/resolve`, { outcome: 'keep_holder', note: 'Again' }).expect(409);

    const counter = await as(ownerA).post('/partner/attribution-disputes', { mobile, note: 'Our referral came first, see the call log' }).expect(201);
    const voided = await as(ops).post(`/ops/attribution-disputes/${counter.body.id}/resolve`, { outcome: 'void', note: 'Both firms worked the case; no protection' }).expect(200);
    expect(voided.body.attribution.endedAt).not.toBeNull();
    expect((await as(ownerA).post('/partner/attribution-disputes', { mobile, note: 'Trying again after the void' }).expect(400)).body.details[0].code).toBe('not_protected');
  });

  it('records partner KYC with a verified PAN, the GSTIN and an encrypted bank account', async () => {
    const pan = firmPan();
    expect((await as(ownerA).patch('/partner/profile', { pan, gstin: `06${firmPan()}1Z5` }).expect(400)).body.details[0].code).toBe('pan_mismatch');
    await as(agentA).patch('/partner/profile', { pan }).expect(403);
    const partial = await as(ownerA).patch('/partner/profile', { pan, gstin: `06${pan}1Z5`, membershipNumber: 'ICAI-123456' }).expect(200);
    expect(partial.body).toMatchObject({ membershipNumber: 'ICAI-123456', kyc: { status: 'pending', bank: null, pan: { verified: true }, gstin: { verified: false } } });
    expect(partial.body.kyc.pan.masked).not.toContain(pan.slice(4, 8));
    const complete = await as(ownerA).patch('/partner/profile', { bankAccount: { accountNumber: '502000123456789', ifsc: 'hdfc0001234', holderName: 'Kulkarni Associates' } }).expect(200);
    expect(complete.body.kyc).toMatchObject({ status: 'verified', bank: { accountLast4: '6789', ifsc: 'HDFC0001234' } });
    expect(complete.body.kyc.verifiedAt).not.toBeNull();
    const stored = await t.prisma.partnerProfile.findUniqueOrThrow({ where: { organizationId: firmA } });
    expect(stored.bankAccountEnc).not.toContain('502000123456789');
    const partnerId = stored.id;
    expect((await as(ops).get(`/admin/partners/${partnerId}`).expect(200)).body.kyc).toMatchObject({ status: 'verified', pan: { verified: true } });
    expect((await as(ownerB).patch('/partner/profile', { pan }).expect(409)).body.code).toBe('IDENTIFIER_IN_USE');
  });
});
