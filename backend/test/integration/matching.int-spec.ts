import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH = 100_000 * 100;

const product = (hard: Array<Record<string, unknown>>, soft: Array<Record<string, unknown>> = []) => ({
  category: 'business',
  segments: ['msme'],
  amountPaise: { min: 5 * LAKH, max: 50 * LAKH },
  tenureMonths: { min: 12, max: 60 },
  coverage: { states: ['06'] },
  eligibility: { hard, soft },
  documents: [{ key: 'udyam', documentTypes: ['udyam_certificate'], stage: 'submission' }, { key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' }],
});

describe('matching an application to live lender products', () => {
  let t: TestApp;
  let manager: StaffSession;
  let ops: StaffSession;
  let borrower: AuthResult;
  let applicationId: string;
  const lenderIds: string[] = [];

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown> = {}) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    patch: (path: string, body: Record<string, unknown>, version: number) => t.api().patch(`/v1${path}`).set(bearer(session.accessToken)).set('If-Match', `"${version}"`).send(body),
  });

  const liveLender = async (key: string, name: string, content: Record<string, unknown>) => {
    const lender = await as(manager).post('/admin/lenders', { key, name, kind: 'nbfc' }).expect(201);
    lenderIds.push(lender.body.id);
    await as(manager).patch(`/admin/lenders/${lender.body.id}`, { status: 'active' }, lender.body.version).expect(200);
    const agreement = await as(manager).post(`/admin/lenders/${lender.body.id}/agreements`, { reference: `${key}-1`, validFrom: new Date().toISOString().slice(0, 10) }).expect(201);
    await as(manager).patch(`/admin/lenders/${lender.body.id}/agreements/${agreement.body.id}`, { status: 'active' }, agreement.body.version).expect(200);
    const created = await as(manager).post('/admin/lender-products', { key: `${key}.working_capital`, name: { en: `${name} Working Capital` }, content }).expect(201);
    const submitted = await as(manager).post(`/admin/lender-products/${created.body.id}/versions/1/submit`, { reason: 'Credit note' }).expect(200);
    await as(ops).post(`/admin/change-requests/${submitted.body.changeRequest.id}/approve`).expect(200);
    await as(manager).post(`/admin/lender-products/${created.body.id}/versions/1/publish`).expect(200);
  };

  beforeAll(async () => {
    t = await startTestApp();
    manager = await createStaffSession(t, Role.lender_manager, 'Kunal Shah');
    ops = await createStaffSession(t, Role.ops_lead, 'Asha Pillai');
    await liveLender('match_easy', 'Easy Finance', product([{ id: 'vintage', when: { attr: 'business.vintage_months', op: 'gte', value: 24 }, pass: { en: 'Your business is old enough for them' } }, { id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, pass: { en: 'You are GST registered' } }], [{ id: 'turnover', weight: 2, when: { attr: 'business.monthly_turnover_paise', op: 'gte', value: 5 * LAKH } }]));
    await liveLender('match_strict', 'Strict Bank', product([{ id: 'vintage', when: { attr: 'business.vintage_months', op: 'gte', value: 60 }, fail: { en: 'They need five years of history' } }]));
    await liveLender('match_curious', 'Curious Capital', product([{ id: 'experience', when: { attr: 'person.work_experience_months', op: 'gte', value: 24 } }]));
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const created = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Shah Textiles', category: 'business' }).expect(201);
    applicationId = created.body.id;
    await as(borrower).patch(`/applications/${applicationId}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH, tenureMonths: 36, city: 'Gurgaon' }, created.body.version).expect(200);
    await t.api().put(`/v1/applications/${applicationId}/answers`).set(bearer(borrower.accessToken)).send({ answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }).expect(200);
  });

  afterAll(async () => {
    for (const id of lenderIds) {
      const lender = await as(manager).get(`/admin/lenders/${id}`).expect(200);
      await as(manager).patch(`/admin/lenders/${id}`, { status: 'offboarded' }, lender.body.version).expect(200);
    }
    await t.close();
  });

  it('ranks eligible lenders first, explains why and hides the ones that cannot lend from borrowers', async () => {
    await as(borrower).get(`/applications/${applicationId}/matches/latest`).expect(404);
    const matched = await as(borrower).post(`/applications/${applicationId}/matches`).expect(201);
    expect(matched.body.eligibleCount).toBe(1);
    expect(matched.body.items.map((item: { product: { key: string }; outcome: string }) => [item.product.key, item.outcome])).toEqual([
      ['match_easy.working_capital', 'eligible'],
      ['match_curious.working_capital', 'needs_info'],
    ]);
    expect(matched.body.items[0]).toMatchObject({ rank: 1, fit: 100, lender: { name: 'Easy Finance', key: 'match_easy' }, product: { name: 'Easy Finance Working Capital' }, reasons: ['They lend in your area', 'Your business is old enough for them', 'You are GST registered'], documentsNeeded: ['udyam', 'statement'] });
    expect(matched.body.items[0].hard).toBeUndefined();
    expect(matched.body.items[1].missingAttributes).toEqual(['person.work_experience_months']);

    const staff = await as(ops).get(`/applications/${applicationId}/matches/latest`).expect(200);
    expect(staff.body.items).toHaveLength(3);
    const strict = staff.body.items.find((item: { product: { key: string } }) => item.product.key === 'match_strict.working_capital');
    expect(strict).toMatchObject({ outcome: 'ineligible', rank: 3, hard: [{ id: 'vintage', outcome: 'fail', message: { en: 'They need five years of history' } }] });
    expect((await as(borrower).get(`/applications/${applicationId}`).expect(200)).body.match).toMatchObject({ matchRunId: matched.body.id });
    await as(ops).post(`/applications/${applicationId}/matches`).expect(403);
  });

  it('re-matches against the current facts and outside the coverage area finds nothing', async () => {
    await as(ops).post(`/ops/cases/${applicationId}/facts/person.work_experience_months/verify`, { value: 48, reason: 'Checked the proprietor CV' }).expect(200);
    const rematched = await as(borrower).post(`/applications/${applicationId}/matches`).expect(201);
    expect(rematched.body.eligibleCount).toBe(2);
    const mumbai = await as(borrower).post('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName: 'Shah Mumbai Branch', category: 'business' }).expect(201);
    await as(borrower).patch(`/applications/${mumbai.body.id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH, tenureMonths: 36, city: 'Mumbai' }, mumbai.body.version).expect(200);
    const nothing = await as(borrower).post(`/applications/${mumbai.body.id}/matches`).expect(201);
    expect(nothing.body).toMatchObject({ eligibleCount: 0, items: [] });
    expect((await as(borrower).get(`/applications/${mumbai.body.id}`).expect(200)).body.match.matchedAt).toBeNull();
  });
});
