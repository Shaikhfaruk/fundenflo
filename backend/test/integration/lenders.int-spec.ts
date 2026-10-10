import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { toInvitationRecipient } from '../../src/modules/access/application/invitation-recipient.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createStaffSession, inviteBySystem, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const today = () => new Date().toISOString().slice(0, 10);

const content = (vintageMonths: number) => ({
  category: 'business',
  segments: ['msme'],
  subSegments: ['proprietorship', 'partnership'],
  amountPaise: { min: 5 * LAKH, max: 50 * LAKH },
  tenureMonths: { min: 12, max: 36 },
  coverage: { states: ['06'] },
  eligibility: {
    hard: [
      { id: 'vintage', when: { attr: 'business.vintage_months', op: 'gte', value: vintageMonths }, pass: { en: 'Business vintage fits their policy' }, fail: { en: 'They need more business history' } },
      { id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, fail: { en: 'They lend only to GST-registered businesses' } },
      { id: 'experience', when: { attr: 'person.work_experience_months', op: 'gte', value: 12 } },
    ],
    soft: [{ id: 'turnover', weight: 3, when: { attr: 'business.monthly_turnover_paise', op: 'gte', value: 5 * LAKH }, minProvenance: 'extracted' }],
  },
  documents: [{ key: 'udyam', documentTypes: ['udyam_certificate'], stage: 'submission' }],
  pricingDisclosure: { en: 'As per lender policy' },
});

describe('lender onboarding, products, availability and simulation', () => {
  let t: TestApp;
  let manager: StaffSession;
  let ops: StaffSession;
  let lenderId: string;
  let organizationId: string;
  let productId: string;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string, query: Record<string, string> = {}) => t.api().get(`/v1${path}`).query(query).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  const availability = async (pincode?: string) => {
    const categories = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'msme', ...(pincode ? { pincode } : {}) }).expect(200);
    return categories.body.items.find((item: { key: string }) => item.key === 'business').availability;
  };

  const publish = async (id: string, number: number) => {
    const submitted = await as(manager).post(`/admin/lender-products/${id}/versions/${number}/submit`, { reason: 'Policy from the lender credit note' }).expect(200);
    await as(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await as(manager).post(`/admin/lender-products/${id}/versions/${number}/publish`).expect(200);
  };

  beforeAll(async () => {
    t = await startTestApp();
    manager = await createStaffSession(t, Role.lender_manager, 'Sonal Gupta');
    ops = await createStaffSession(t, Role.ops_lead, 'Arvind Rao');
    const haryana = await t.prisma.geoState.findUniqueOrThrow({ where: { gstCode: '06' } });
    const maharashtra = await t.prisma.geoState.findUniqueOrThrow({ where: { gstCode: '27' } });
    const gurugram = await t.prisma.geoCity.findFirstOrThrow({ where: { stateId: haryana.id, name: 'Gurugram' } });
    await t.prisma.geoPincode.upsert({ where: { pincode: '122001' }, create: { pincode: '122001', stateId: haryana.id, cityId: gurugram.id }, update: {} });
    await t.prisma.geoPincode.upsert({ where: { pincode: '400001' }, create: { pincode: '400001', stateId: maharashtra.id }, update: {} });
  });

  afterAll(async () => {
    const lender = await as(manager).get(`/admin/lenders/${lenderId}`).expect(200);
    await as(manager).patch(`/admin/lenders/${lenderId}`, { status: 'offboarded' }, lender.body.version).expect(200);
    await t.close();
  });

  it('onboards a lender with an agreement and escalation contacts', async () => {
    const created = await as(manager).post('/admin/lenders', { key: 'lenderx', name: 'Lender X Finance Ltd', kind: 'nbfc', rbiRegistrationNo: 'N-14.03268', responseSlaHours: 48 }).expect(201);
    expect(created.body).toMatchObject({ key: 'lenderx', name: 'Lender X Finance Ltd', status: 'onboarding', kind: 'nbfc' });
    lenderId = created.body.id;
    organizationId = created.body.organizationId;
    await as(manager).post('/admin/lenders', { key: 'lenderx', name: 'Duplicate', kind: 'bank' }).expect(409);
    expect((await t.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).type).toBe('lender');

    const active = await as(manager).patch(`/admin/lenders/${lenderId}`, { status: 'active' }, created.body.version).expect(200);
    expect(active.body.status).toBe('active');
    await as(manager).patch(`/admin/lenders/${lenderId}`, { status: 'onboarding' }, active.body.version).expect(409);

    const docType = await as(ops).post('/admin/document-types', { key: 'lender_agreement', label: { en: 'Lender Agreement' }, acceptedMimeTypes: ['application/pdf'], maxSizeBytes: 5_000_000, sensitivity: 'financial' }).expect(201);
    const signed = await t.api().post('/v1/documents').set(bearer(manager.accessToken)).field('documentType', docType.body.key).field('lenderId', lenderId).attach('file', Buffer.from('%PDF-1.7\nsigned agreement\n%%EOF\n'), { filename: 'agreement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(signed.body).toMatchObject({ borrowerProfileId: null, applicationId: null });

    const agreement = await as(manager).post(`/admin/lenders/${lenderId}/agreements`, { reference: 'LX-2026-01', validFrom: today(), commissionNote: '50 bps of the disbursed amount, paid after the lender pays', documentId: signed.body.id }).expect(201);
    expect(agreement.body).toMatchObject({ status: 'draft', inForce: false, documentId: signed.body.id });
    await as(manager).post(`/admin/lenders/${lenderId}/agreements`, { reference: 'LX-2026-02', validFrom: today(), validTo: '2020-01-01' }).expect(400);
    const inForce = await as(manager).patch(`/admin/lenders/${lenderId}/agreements/${agreement.body.id}`, { status: 'active' }, agreement.body.version).expect(200);
    expect(inForce.body).toMatchObject({ status: 'active', inForce: true });
    await as(manager).patch(`/admin/lenders/${lenderId}/agreements/${agreement.body.id}`, { status: 'terminated' }, inForce.body.version).expect(400);

    const contact = await as(manager).post(`/admin/lenders/${lenderId}/contacts`, { name: 'Rahul Bhatia', designation: 'Regional Credit Head', role: 'escalation', email: 'rahul.bhatia@sustaininsight.com', escalationLevel: 2 }).expect(201);
    expect(contact.body.email).toMatch(/^ra•+@sustaininsight\.com$/);
    await as(manager).post(`/admin/lenders/${lenderId}/contacts`, { name: 'No Way To Reach', role: 'credit' }).expect(400);
    await as(manager).post(`/admin/lenders/${lenderId}/contacts`, { name: 'Bad Email', role: 'credit', email: 'not-an-email' }).expect(400);
    const inactive = await as(manager).patch(`/admin/lenders/${lenderId}/contacts/${contact.body.id}`, { active: false }, contact.body.version).expect(200);
    expect(inactive.body.active).toBe(false);
    expect((await as(manager).get(`/admin/lenders/${lenderId}/contacts`).expect(200)).body.items).toHaveLength(1);

    const support = await createStaffSession(t, Role.support, 'Tara Singh');
    expect((await as(support).get('/admin/lenders').expect(200)).body.items.map((item: { key: string }) => item.key)).toContain('lenderx');
    await as(support).post('/admin/lenders', { key: 'nope', name: 'Nope', kind: 'bank' }).expect(403);
  });

  it('publishes a product through maker-checker, which opens the category where it lends', async () => {
    expect(await availability('122001')).toEqual({ available: false, reason: 'NO_VERIFIED_LENDER_ROUTE' });

    const orphan = await as(manager).post('/admin/lender-products', { key: 'nolender.product', name: { en: 'Orphan' }, content: content(24) }).expect(201);
    const refused = await as(manager).post(`/admin/lender-products/${orphan.body.id}/versions/1/submit`, { reason: 'Trying an orphan product' }).expect(400);
    expect(refused.body.details.map((issue: { code: string }) => issue.code)).toContain('unknown_lender');
    const broken = await as(manager).post('/admin/lender-products', { key: 'lenderx.broken', name: { en: 'Broken' }, content: { ...content(24), coverage: { states: ['99'] }, eligibility: { hard: [{ id: 'x', when: { attr: 'nope.attr', op: 'eq', value: 1 } }] } } }).expect(201);
    const brokenIssues = await as(manager).post(`/admin/lender-products/${broken.body.id}/versions/1/submit`, { reason: 'Trying a broken product' }).expect(400);
    expect(brokenIssues.body.details.map((issue: { code: string }) => issue.code).toSorted()).toEqual(['invalid_condition', 'unknown_state']);

    const product = await as(manager).post('/admin/lender-products', { key: 'lenderx.working_capital', name: { en: 'Lender X Working Capital' }, content: content(24) }).expect(201);
    productId = product.body.id;
    await publish(productId, 1);

    expect(await availability('122001')).toEqual({ available: true, reason: null });
    expect(await availability('400001')).toEqual({ available: false, reason: 'NO_VERIFIED_LENDER_ROUTE' });
    expect(await availability()).toEqual({ available: true, reason: null });

    const lender = await as(manager).get(`/admin/lenders/${lenderId}`).expect(200);
    const paused = await as(manager).patch(`/admin/lenders/${lenderId}`, { status: 'paused' }, lender.body.version).expect(200);
    expect(await availability('122001')).toEqual({ available: false, reason: 'NO_VERIFIED_LENDER_ROUTE' });
    await as(manager).patch(`/admin/lenders/${lenderId}`, { status: 'active' }, paused.body.version).expect(200);
    expect((await availability('122001')).available).toBe(true);
  });

  it('simulates a stricter draft against test profiles and the published version', async () => {
    await as(manager).post(`/admin/lender-products/${productId}/versions`, { content: content(36) }).expect(201);
    const profile = (label: string, vintage: number, extra: Array<Record<string, unknown>> = []) => ({
      label,
      request: { segment: 'msme', subSegment: 'proprietorship', category: 'business', amountPaise: 20 * LAKH, tenureMonths: 24, pincode: '122001' },
      facts: [{ attribute: 'business.vintage_months', value: vintage }, { attribute: 'business.gst_registered', value: true }, { attribute: 'person.work_experience_months', value: 60 }, ...extra],
    });
    const result = await as(manager).post(`/admin/lender-products/${productId}/versions/2/simulate`, {
      profiles: [profile('Thirty months old', 30), profile('Five years old', 60, [{ attribute: 'business.monthly_turnover_paise', value: 8 * LAKH, provenance: 'extracted' }]), { ...profile('Mumbai shop', 60), request: { segment: 'msme', subSegment: 'llp', pincode: '400001' } }],
    }).expect(200);
    expect(result.body).toMatchObject({ number: 2, publishedNumber: 1 });
    const [thirty, five, mumbai] = result.body.results;
    expect(thirty).toMatchObject({ label: 'Thirty months old', changed: true, version: { eligibility: { eligibility: 'ineligible' } }, published: { number: 1, eligibility: { eligibility: 'eligible' } } });
    expect(thirty.version.eligibility.hard[0]).toMatchObject({ id: 'vintage', outcome: 'fail', message: { en: 'They need more business history' } });
    expect(five).toMatchObject({ changed: false, version: { screen: { outcome: 'pass' }, eligibility: { eligibility: 'eligible', softScore: 3, softMax: 3 } } });
    expect(mumbai.version.screen.reasons.map((reason: { code: string }) => reason.code)).toEqual(['sub_segment_mismatch', 'amount_unknown', 'tenure_unknown', 'outside_coverage']);
    const bad = await as(manager).post(`/admin/lender-products/${productId}/versions/2/simulate`, { profiles: [{ label: 'Bad', request: { segment: 'msme' }, facts: [{ attribute: 'business.vintage_months', value: 'old' }, { attribute: 'nope.attr', value: 1 }] }] }).expect(400);
    expect(bad.body.details.map((issue: { code: string }) => issue.code)).toEqual(['invalid_value', 'unknown_attribute']);
  });

  it('asks lender knock-out questions only of borrowers the product could serve', async () => {
    const borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const msme = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Yadav Tiles', category: 'business' }).expect(201);
    const questions = await as(borrower).get(`/applications/${msme.body.id}/questions`, { stage: 'pre_check' }).expect(200);
    expect(questions.body.progressive).toEqual([expect.objectContaining({ questionKey: 'work_experience', attributeKey: 'person.work_experience_months', neededBy: ['lenderx.working_capital'] })]);
    const personal = await as(borrower).post('/applications', { segment: 'individual', subSegment: 'salaried', category: 'personal' }).expect(201);
    const individual = await as(borrower).get(`/applications/${personal.body.id}/questions`, { stage: 'pre_check' }).expect(200);
    expect(individual.body.progressive ?? []).toEqual([]);
  });

  it('shows the lender its products and takes its proposed changes for FundenFlo approval', async () => {
    const adminMobile = randomMobile();
    await inviteBySystem(t, { organizationId, role: Role.lender_admin, ...toInvitationRecipient({ mobile: adminMobile, countryCode: '+91' }) });
    const admin = await otpLogin(t, adminMobile, LoginAs.lender);
    const viewerMobile = randomMobile();
    await inviteBySystem(t, { organizationId, role: Role.lender_viewer, ...toInvitationRecipient({ mobile: viewerMobile, countryCode: '+91' }) });
    const viewer = await otpLogin(t, viewerMobile, LoginAs.lender);

    const listed = await as(viewer).get('/lender/products').expect(200);
    expect(listed.body).toMatchObject({ lender: { key: 'lenderx', status: 'active' }, items: [{ id: productId, key: 'lenderx.working_capital', number: 1, name: expect.any(Object), content: expect.any(Object), pendingVersion: { number: 2, status: 'draft' } }] });
    await as(viewer).post(`/lender/products/${productId}/change-requests`, { content: content(18), reason: 'We now lend from 18 months' }).expect(403);
    await as(admin).post(`/lender/products/${productId}/change-requests`, { content: content(18), reason: 'We now lend from 18 months' }).expect(409);

    const draft = await as(manager).get(`/admin/lender-products/${productId}/versions/2`).expect(200);
    await as(manager).post(`/admin/lender-products/${productId}/versions/2/retire`, { reason: 'Superseded by the lender proposal' }).expect(200);
    expect(draft.body.status).toBe('draft');
    const proposed = await as(admin).post(`/lender/products/${productId}/change-requests`, { content: content(18), reason: 'We now lend from 18 months' }).expect(201);
    expect(proposed.body).toMatchObject({ status: 'in_review', changeRequest: { status: 'pending' } });
    expect((await as(admin).get('/lender/products').expect(200)).body.items[0].pendingVersion).toMatchObject({ number: proposed.body.number, status: 'in_review' });
    await as(ops).post(`/admin/change-requests/${proposed.body.changeRequest.id}/approve`).expect(200);
    await as(manager).post(`/admin/lender-products/${productId}/versions/${proposed.body.number}/publish`).expect(200);
    expect((await as(admin).get('/lender/products').expect(200)).body.items[0].definition.hard[0].when.value).toBe(18);
    expect((await as(ops).get('/lender/products').expect(403)).body.code).toBe('CONTEXT_NOT_ALLOWED');
  });
});
