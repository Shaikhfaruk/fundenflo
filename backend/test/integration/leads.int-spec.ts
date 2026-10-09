import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const LAKH_PAISE = 10_000_000;

describe('leads', () => {
  let t: TestApp;
  let ops: StaffSession;
  let checker: StaffSession;
  let reviewer: StaffSession;
  let support: StaffSession;
  const mobile = randomMobile();
  let firstLead: { id: string; ref: string; party: { id: string }; version: number };

  const capture = (staff: StaffSession, body: Record<string, unknown>) => t.api().post('/v1/ops/leads').set(bearer(staff.accessToken)).send(body);
  const backlogConsent = { basis: 'consent', evidence: 'Website form checkbox, 2026-08-14', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Anjali Bose');
    checker = await createStaffSession(t, Role.ops_lead, 'Vivek Shetty');
    reviewer = await createStaffSession(t, Role.ops_reviewer, 'Pooja Nair');
    support = await createStaffSession(t, Role.support, 'Rahul Verma');
  });

  afterAll(async () => {
    await t.close();
  });

  it('captures an ops lead with a resolved city, parsed amount, business and consent evidence', async () => {
    const response = await capture(ops, {
      name: 'Ramesh Kumar',
      mobile,
      businessName: 'Kumar Traders',
      segment: 'msme',
      category: 'business',
      amountText: '20-25 lakh',
      city: 'Gurgaon',
      urgency: 'within_month',
      preferredLanguage: 'hi',
      consent: backlogConsent,
    }).expect(201);
    firstLead = response.body;
    expect(response.body).toMatchObject({
      status: 'new',
      consentStatus: 'ok',
      lawfulBasis: 'consent',
      categoryKey: 'business',
      business: { displayName: 'Kumar Traders' },
      amount: { minPaise: 20 * LAKH_PAISE, maxPaise: 25 * LAKH_PAISE, text: '20-25 lakh' },
      location: { city: { name: 'Gurugram' }, state: { gstCode: '06' } },
      flags: [],
      source: { key: 'manual' },
    });
    expect(response.body.ref).toMatch(/^LD-\d{2}-\d{6}$/);
    expect(response.body.qualityScore).toBe(95);
    expect(response.body.contacts[0]).toMatchObject({ type: 'mobile', masked: expect.stringContaining('•') });
    expect(response.body.events[0]).toMatchObject({ type: 'captured', toStatus: 'new', actorType: 'user', actorUserId: ops.user.id });

    const row = await t.prisma.lead.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(row.rawPayloadEnc).toMatch(/^v1:/);
    await expect(t.prisma.$executeRaw`UPDATE lead_events SET note = 'x' WHERE lead_id = ${row.id}::uuid`).rejects.toThrow(/append-only/);
  });

  it('flags repeat enquiries, links the same person, and sends name conflicts on a shared phone to review', async () => {
    const repeat = await capture(ops, { name: 'Ramesh K', mobile, category: 'business', amountText: '30 lakh' }).expect(201);
    expect(repeat.body).toMatchObject({ party: { id: firstLead.party.id }, flags: ['duplicate'], duplicateOfLeadId: firstLead.id, consentStatus: 'ok' });

    const otherCategory = await capture(ops, { name: 'Ramesh Kumar', mobile, category: 'personal' }).expect(201);
    expect(otherCategory.body.flags).toEqual([]);

    const sharedPhone = await capture(ops, { name: 'Sunita Devi', mobile, category: 'business' }).expect(201);
    expect(sharedPhone.body.party.id).not.toBe(firstLead.party.id);
    expect(sharedPhone.body.consentStatus).toBe('pending');
    const review = await t.prisma.partyMatchReview.findFirst({ where: { partyId: sharedPhone.body.party.id } });
    expect(review?.candidatePartyIds).toEqual([firstLead.party.id]);
  });

  it('keeps imperfect leads with flags instead of rejecting them, but needs one usable contact', async () => {
    const noContact = await capture(ops, { name: 'No Contact', mobile: '1234567' }).expect(400);
    expect(noContact.body.details[0]).toMatchObject({ path: 'mobile', code: 'contact_required' });

    const messy = await capture(ops, { name: 'Messy Lead', mobile: '1234567', email: 'messy.lead@sustaininsight.com', city: 'Atlantis', category: 'spaceship loan', flags: ['test'] }).expect(201);
    expect(messy.body.flags.toSorted()).toEqual(['invalid_number', 'test', 'unmapped_category', 'unmapped_location']);
    expect(messy.body.location).toMatchObject({ city: null, text: 'Atlantis' });
    expect(messy.body.consentStatus).toBe('pending');

    await capture(ops, { name: 'Bad Segment', mobile: randomMobile(), segment: 'spaceships' }).expect(400);
  });

  it('lists leads by ref, name, consent queue and status', async () => {
    const byRef = await t.api().get('/v1/ops/leads').query({ q: firstLead.ref }).set(bearer(reviewer.accessToken)).expect(200);
    expect(byRef.body.items.map((lead: { id: string }) => lead.id)).toEqual([firstLead.id]);
    const byName = await t.api().get('/v1/ops/leads').query({ q: 'messy' }).set(bearer(reviewer.accessToken)).expect(200);
    expect(byName.body.items).toHaveLength(1);
    const pending = await t.api().get('/v1/ops/leads').query({ consentStatus: 'pending', source: 'manual' }).set(bearer(reviewer.accessToken)).expect(200);
    expect(pending.body.items.every((lead: { consentStatus: string }) => lead.consentStatus === 'pending')).toBe(true);
    expect(pending.body.items.length).toBeGreaterThanOrEqual(2);
    const multi = await t.api().get(`/v1/ops/leads?status=new&status=qualified&q=${firstLead.ref}`).set(bearer(reviewer.accessToken)).expect(200);
    expect(multi.body.items).toHaveLength(1);
  });

  it('moves leads through the lifecycle with reasons and keeps closed leads closed', async () => {
    await t.api().post(`/v1/ops/leads/${firstLead.id}/qualify`).set(bearer(reviewer.accessToken)).send({ note: 'Spoke to the owner' }).expect(200);
    await t.api().post(`/v1/ops/leads/${firstLead.id}/disqualify`).set(bearer(reviewer.accessToken)).send({}).expect(400);
    const held = await t.api().post(`/v1/ops/leads/${firstLead.id}/hold`).set(bearer(reviewer.accessToken)).send({ note: 'Call back after Diwali', holdUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() }).expect(200);
    expect(held.body).toMatchObject({ status: 'on_hold', statusNote: 'Call back after Diwali' });
    await t.api().post(`/v1/ops/leads/${firstLead.id}/reopen`).set(bearer(reviewer.accessToken)).send({}).expect(200);

    const current = await t.api().get(`/v1/ops/leads/${firstLead.id}`).set(bearer(reviewer.accessToken)).expect(200);
    await t.api().patch(`/v1/ops/leads/${firstLead.id}`).set(bearer(reviewer.accessToken)).set('If-Match', '"1"').send({ tenureMonths: 36 }).expect(409);
    const edited = await t.api().patch(`/v1/ops/leads/${firstLead.id}`).set(bearer(reviewer.accessToken)).set('If-Match', `"${current.body.version}"`)
      .send({ category: 'working-capital', amountMinPaise: 15 * LAKH_PAISE, amountMaxPaise: 20 * LAKH_PAISE, pincode: '122002' }).expect(200);
    expect(edited.body).toMatchObject({ categoryKey: 'working-capital', amount: { minPaise: 15 * LAKH_PAISE }, location: { pincode: '122002' } });
    await t.api().patch(`/v1/ops/leads/${firstLead.id}`).set(bearer(reviewer.accessToken)).send({ amountMinPaise: 30 * LAKH_PAISE }).expect(400);

    const lost = await t.api().post(`/v1/ops/leads/${firstLead.id}/lose`).set(bearer(reviewer.accessToken)).send({ reason: 'went_elsewhere', note: 'Took a loan from their bank' }).expect(200);
    expect(lost.body).toMatchObject({ status: 'lost', lostReason: 'went_elsewhere' });
    const closed = await t.api().post(`/v1/ops/leads/${firstLead.id}/qualify`).set(bearer(reviewer.accessToken)).send({}).expect(409);
    expect(closed.body.code).toBe('INVALID_TRANSITION');
    expect(lost.body.events.map((event: { type: string }) => event.type)).toEqual(['status_changed', 'edited', 'status_changed', 'status_changed', 'status_changed', 'captured']);
  });

  it('merges duplicates of the same person only, and reveals contacts with an audit trail', async () => {
    const survivor = await capture(ops, { name: 'Meena Iyer', mobile: randomMobile(), category: 'home' }).expect(201);
    const duplicate = await capture(ops, { name: 'Meena Iyer', email: 'meena.iyer@sustaininsight.com', landline: '011 2345 6789' }).expect(201);
    const sameParty = await capture(ops, { name: 'Meena', email: 'meena.iyer@sustaininsight.com', category: 'home' }).expect(201);

    const wrong = await t.api().post('/v1/ops/leads/merge').set(bearer(ops.accessToken)).send({ survivorLeadId: survivor.body.id, leadIds: [duplicate.body.id], note: 'Same enquiry twice' }).expect(400);
    expect(wrong.body.details[0].code).toBe('different_party');
    const merged = await t.api().post('/v1/ops/leads/merge').set(bearer(ops.accessToken)).send({ survivorLeadId: duplicate.body.id, leadIds: [sameParty.body.id], note: 'Same enquiry twice' }).expect(200);
    expect(merged.body.events[0]).toMatchObject({ type: 'merged' });
    const loser = await t.api().get(`/v1/ops/leads/${sameParty.body.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(loser.body).toMatchObject({ status: 'unqualified', unqualifiedReason: 'duplicate', mergedIntoLeadId: duplicate.body.id });

    await t.api().post(`/v1/ops/leads/${duplicate.body.id}/reveal-contact`).set(bearer(support.accessToken)).send({ reason: 'Calling the customer' }).expect(403);
    const revealed = await t.api().post(`/v1/ops/leads/${duplicate.body.id}/reveal-contact`).set(bearer(reviewer.accessToken)).send({ reason: 'Calling the customer back' }).expect(200);
    expect(revealed.body.contacts.map((contact: { type: string; value: string }) => `${contact.type}:${contact.value}`).toSorted()).toEqual(['email:meena.iyer@sustaininsight.com', 'landline:+911123456789']);
    const audit = await t.prisma.auditEvent.findFirst({ where: { action: 'lead.contact_revealed', entityId: duplicate.body.id } });
    expect(audit?.actorUserId).toBe(reviewer.user.id);
  });

  it('takes leads from a website form with an API key, with source-specific questions and idempotent retries', async () => {
    const source = await t.api().post('/v1/admin/lead-sources').set(bearer(ops.accessToken)).send({ key: 'website_diwali', name: 'Diwali landing page', kind: 'web_form' }).expect(201);
    const created = await t.api().post('/v1/admin/api-clients').set(bearer(ops.accessToken)).send({ name: 'Diwali landing page form', scopes: ['leads:create'], leadSourceId: source.body.id }).expect(201);
    const key: string = created.body.key;
    expect(key).toMatch(/^ffk_/);
    expect(created.body.client).toMatchObject({ status: 'active', keyPrefix: expect.any(String) });
    expect(created.body.client.keyHash).toBeUndefined();

    const set = await t.api().post('/v1/admin/question-sets').set(bearer(ops.accessToken)).send({
      key: 'lead_capture.website_diwali',
      name: { en: 'Diwali Form Questions' },
      content: { stage: 'lead_capture', scope: { leadSources: ['website_diwali'] }, items: [{ questionKey: 'business_age' }, { questionKey: 'gst_registered', required: false }] },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/question-sets/${set.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Diwali campaign form' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/question-sets/${set.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);

    const body = { name: 'Farida Khan', mobile: randomMobile(), segment: 'msme', category: 'working capital', externalRef: 'diwali-0001', utm: { utm_source: 'google', utm_campaign: 'diwali' }, answers: [{ questionKey: 'business_age', value: '5+' }] };
    const missing = await t.api().post('/v1/public/leads').send(body).expect(401);
    expect(missing.body.code).toBe('API_KEY_INVALID');
    const first = await t.api().post('/v1/public/leads').set('X-Api-Key', key).send(body).expect(201);
    expect(first.body).toMatchObject({ status: 'new', replayed: false, ref: expect.stringMatching(/^LD-/) });
    const retry = await t.api().post('/v1/public/leads').set('X-Api-Key', key).send(body).expect(200);
    expect(retry.body).toEqual({ ...first.body, replayed: true });

    const detail = await t.api().get(`/v1/ops/leads/${first.body.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body).toMatchObject({ source: { key: 'website_diwali' }, consentStatus: 'pending', utm: { utm_campaign: 'diwali' }, apiClientId: created.body.client.id });
    expect(detail.body.events[0]).toMatchObject({ type: 'captured', actorType: 'api_client', actorUserId: null });
    const facts = await t.api().get(`/v1/ops/parties/${detail.body.party.id}/facts`).set(bearer(ops.accessToken)).expect(200);
    expect(facts.body.items).toEqual([expect.objectContaining({ attributeKey: 'business.vintage_months', value: { min: 60, max: null }, provenance: 'declared' })]);

    await t.api().delete(`/v1/admin/api-clients/${created.body.client.id}`).set(bearer(ops.accessToken)).expect(200);
    await t.api().post('/v1/public/leads').set('X-Api-Key', key).send({ ...body, externalRef: 'diwali-0002' }).expect(401);
  });
});
