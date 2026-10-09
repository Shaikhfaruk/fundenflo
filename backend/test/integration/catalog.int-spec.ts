import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('catalog and geography', () => {
  let t: TestApp;
  let admin: StaffSession;

  beforeAll(async () => {
    t = await startTestApp();
    admin = await createStaffSession(t, Role.ops_lead, 'Arjun Nair');
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves segments with sub-segments in display order', async () => {
    const response = await t.api().get('/v1/catalog/segments').expect(200);
    expect(response.body.items.map((segment: { key: string }) => segment.key)).toEqual(['msme', 'individual']);
    expect(response.body.items[0]).toMatchObject({ label: 'Business / MSME', subSegments: [{ key: 'proprietorship' }, { key: 'partnership' }, { key: 'llp' }, { key: 'private_limited' }] });
  });

  it('serves categories per segment in that segment\'s order, with paise amounts and truthful availability', async () => {
    const individual = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'individual' }).expect(200);
    expect(individual.body.items.map((category: { key: string }) => category.key)).toEqual(['personal', 'home', 'vehicle', 'lap']);

    const msme = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'msme' }).set('Accept-Language', 'hi-IN').expect(200);
    const business = msme.body.items.find((category: { key: string }) => category.key === 'business');
    expect(business).toMatchObject({
      label: 'Business Loan',
      minAmountPaise: 50_000_000,
      maxAmountPaise: 2_000_000_000,
      defaultAmountPaise: 250_000_000,
      tenureOptionsMonths: [12, 24, 36, 60],
      availability: { available: false, reason: 'NO_VERIFIED_LENDER_ROUTE' },
    });
    expect(business.purposes.at(-1)).toEqual({ key: 'other', label: 'Something Else', requiresNote: true });
  });

  it('lists states by GST code and finds cities by name, alias and second word', async () => {
    const states = await t.api().get('/v1/catalog/geo/states').expect(200);
    expect(states.body.items).toHaveLength(36);
    expect(states.body.items.find((state: { gstCode: string }) => state.gstCode === '06')).toMatchObject({ name: 'Haryana', kind: 'state' });

    const byPrefix = await t.api().get('/v1/catalog/geo/cities').query({ q: 'gurug' }).expect(200);
    expect(byPrefix.body.items.map((city: { name: string }) => city.name)).toEqual(['Gurugram']);
    const byAlias = await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurgaon' }).expect(200);
    expect(byAlias.body.items.map((city: { name: string }) => city.name)).toEqual(['Gurugram']);
    const bySecondWord = await t.api().get('/v1/catalog/geo/cities').query({ q: 'delhi' }).expect(200);
    expect(bySecondWord.body.items.map((city: { name: string }) => city.name)).toEqual(['New Delhi']);
  });

  it('returns 404 for unknown pincodes and serves them after an admin adds them', async () => {
    await t.api().get('/v1/catalog/geo/pincodes/122002').expect(404);
    const cities = await t.api().get('/v1/admin/geo/cities').query({ q: 'Gurugram' }).set(bearer(admin.accessToken)).expect(200);
    const gurugram = cities.body.items[0];
    await t.api().post('/v1/admin/geo/pincodes').set(bearer(admin.accessToken)).send({ pincode: '122002', stateGstCode: '06', cityId: gurugram.id, district: 'Gurugram' }).expect(200);
    const pincode = await t.api().get('/v1/catalog/geo/pincodes/122002').expect(200);
    expect(pincode.body).toMatchObject({ pincode: '122002', district: 'Gurugram', state: { gstCode: '06' }, city: { name: 'Gurugram' } });

    const mismatch = await t.api().post('/v1/admin/geo/pincodes').set(bearer(admin.accessToken)).send({ pincode: '110001', stateGstCode: '07', cityId: gurugram.id }).expect(400);
    expect(mismatch.body.details[0].code).toBe('city_state_mismatch');
  });

  it('creates and updates a category and the public catalog reflects it immediately', async () => {
    const before = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'msme' }).expect(200);
    expect(before.body.items.some((category: { key: string }) => category.key === 'supply-chain')).toBe(false);

    const invalid = await t.api().post('/v1/admin/loan-categories').set(bearer(admin.accessToken)).send({
      key: 'supply-chain', label: { en: 'Supply Chain Finance' }, icon: 'receipt',
      minAmountPaise: 100_000_000, maxAmountPaise: 50_000_000, stepPaise: 10_000_000, defaultAmountPaise: 60_000_000,
      tenureOptionsMonths: [12], segmentKeys: ['msme'],
    }).expect(400);
    expect(invalid.body.details.map((detail: { path: string }) => detail.path)).toContain('minAmountPaise');

    const created = await t.api().post('/v1/admin/loan-categories').set(bearer(admin.accessToken)).send({
      key: 'supply-chain', label: { en: 'Supply Chain Finance' }, icon: 'receipt',
      minAmountPaise: 50_000_000, maxAmountPaise: 1_000_000_000, stepPaise: 10_000_000, defaultAmountPaise: 100_000_000,
      tenureOptionsMonths: [6, 12, 6], segmentKeys: ['msme'],
      purposes: [{ key: 'dealer', label: { en: 'Pay Dealers Faster' } }],
    }).expect(201);
    expect(created.body.tenureOptionsMonths).toEqual([6, 12]);

    const after = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'msme' }).expect(200);
    expect(after.body.items.some((category: { key: string }) => category.key === 'supply-chain')).toBe(true);

    const stale = await t.api().patch(`/v1/admin/loan-categories/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', '"9"').send({ status: 'inactive' }).expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    await t.api().patch(`/v1/admin/loan-categories/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', `"${created.body.version}"`).send({ status: 'inactive' }).expect(200);
    const hidden = await t.api().get('/v1/catalog/loan-categories').query({ segment: 'msme' }).expect(200);
    expect(hidden.body.items.some((category: { key: string }) => category.key === 'supply-chain')).toBe(false);
  });

  it('adds purposes and aliases that the public endpoints use', async () => {
    const categories = await t.api().get('/v1/admin/loan-categories').set(bearer(admin.accessToken)).expect(200);
    const vehicle = categories.body.items.find((category: { key: string }) => category.key === 'vehicle');
    await t.api().post(`/v1/admin/loan-categories/${vehicle.id}/purposes`).set(bearer(admin.accessToken)).send({ key: 'electric', label: { en: 'Electric Vehicle' } }).expect(201);
    const publicVehicle = (await t.api().get('/v1/catalog/loan-categories').query({ segment: 'individual' }).expect(200)).body.items.find((category: { key: string }) => category.key === 'vehicle');
    expect(publicVehicle.purposes.map((purpose: { key: string }) => purpose.key)).toContain('electric');

    const cities = await t.api().get('/v1/admin/geo/cities').query({ q: 'Thane' }).set(bearer(admin.accessToken)).expect(200);
    await t.api().post('/v1/admin/lookup-aliases').set(bearer(admin.accessToken)).send({ kind: 'city', alias: 'Thana', targetId: cities.body.items[0].id }).expect(201);
    const found = await t.api().get('/v1/catalog/geo/cities').query({ q: 'thana' }).expect(200);
    expect(found.body.items.map((city: { name: string }) => city.name)).toEqual(['Thane']);
  });

  it('allows read-only staff to read but not change the catalog, and keeps borrowers out', async () => {
    const support = await createStaffSession(t, Role.support, 'Kavya Reddy');
    await t.api().get('/v1/admin/loan-categories').set(bearer(support.accessToken)).expect(200);
    await t.api().post('/v1/admin/segments').set(bearer(support.accessToken)).send({ key: 'trust', label: { en: 'Trust' } }).expect(403);

    const borrower = await otpLogin(t, randomMobile());
    await t.api().get('/v1/admin/loan-categories').set(bearer(borrower.accessToken)).expect(403);
  });
});
