import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PartyKind, Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const TURNOVER = 'business.monthly_turnover_paise';
const GST = 'business.gst_registered';
const VINTAGE = 'business.vintage_months';

describe('attribute dictionary, facts and conditions', () => {
  let t: TestApp;
  let admin: StaffSession;
  let partyId: string;

  beforeAll(async () => {
    t = await startTestApp();
    admin = await createStaffSession(t, Role.ops_lead, 'Rohan Mehta');
    partyId = (await t.prisma.party.create({ data: { kind: PartyKind.business, displayName: 'Shree Balaji Traders' } })).id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves the seeded pre-check dictionary and filters by subject', async () => {
    const all = await t.api().get('/v1/admin/attributes').set(bearer(admin.accessToken)).expect(200);
    const keys = all.body.items.map((attribute: { key: string }) => attribute.key);
    expect(keys).toEqual(expect.arrayContaining([TURNOVER, GST, VINTAGE, 'person.net_monthly_income_paise', 'person.employment_type', 'borrower.has_existing_emis']));

    const people = await t.api().get('/v1/admin/attributes').query({ subject: 'person' }).set(bearer(admin.accessToken)).expect(200);
    expect(people.body.items.every((attribute: { subject: string }) => attribute.subject === 'person')).toBe(true);
    const constitution = all.body.items.find((attribute: { key: string }) => attribute.key === 'business.constitution');
    expect(constitution.enumValues.map((option: { value: string }) => option.value)).toContain('private_limited');
  });

  it('creates and versions attributes, keeping enum values append-only', async () => {
    const missingValues = await t.api().post('/v1/admin/attributes').set(bearer(admin.accessToken)).send({
      key: 'business.industry', label: { en: 'Industry' }, dataType: 'enum', subject: 'business', sensitivity: 'public', allowedProvenance: ['declared'],
    }).expect(400);
    expect(missingValues.body.details[0]).toMatchObject({ path: 'enumValues', code: 'required' });

    const created = await t.api().post('/v1/admin/attributes').set(bearer(admin.accessToken)).send({
      key: 'business.industry', label: { en: 'Industry', hi: 'उद्योग' }, dataType: 'enum', subject: 'business', sensitivity: 'public',
      allowedProvenance: ['declared', 'ops_verified'],
      enumValues: [{ value: 'manufacturing', label: { en: 'Manufacturing' } }, { value: 'trading', label: { en: 'Trading' } }],
    }).expect(201);
    expect(created.body).toMatchObject({ key: 'business.industry', status: 'active', version: 1 });

    await t.api().post('/v1/admin/attributes').set(bearer(admin.accessToken)).send({
      key: 'business.industry', label: { en: 'Industry' }, dataType: 'string', subject: 'business', sensitivity: 'public', allowedProvenance: ['declared'],
    }).expect(409);

    const removal = await t.api().patch(`/v1/admin/attributes/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', '"1"')
      .send({ enumValues: [{ value: 'manufacturing', label: { en: 'Manufacturing' } }] }).expect(400);
    expect(removal.body.details[0].code).toBe('enum_value_removed');

    const updated = await t.api().patch(`/v1/admin/attributes/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', '"1"')
      .send({ enumValues: [...created.body.enumValues, { value: 'services', label: { en: 'Services' } }] }).expect(200);
    expect(updated.body.version).toBe(2);
    await t.api().patch(`/v1/admin/attributes/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', '"1"').send({ freshnessDays: 30 }).expect(409);
  });

  it('validates conditions against the dictionary', async () => {
    const good = await t.api().post('/v1/admin/conditions/validate').set(bearer(admin.accessToken)).send({
      condition: { all: [{ attr: TURNOVER, op: 'gte', value: 50_000_000 }, { attr: GST, op: 'eq', value: true }] },
    }).expect(200);
    expect(good.body).toEqual({ valid: true, issues: [], attributes: [TURNOVER, GST] });

    const bad = await t.api().post('/v1/admin/conditions/validate').set(bearer(admin.accessToken)).send({
      condition: { any: [{ attr: 'business.unknown_thing', op: 'eq', value: 1 }, { attr: GST, op: 'gte', value: 3 }] },
    }).expect(200);
    expect(bad.body.valid).toBe(false);
    expect(bad.body.issues.map((issue: { path: string }) => issue.path)).toEqual(['$.any[0].attr', '$.any[1].op']);
  });

  it('records ops-verified facts, picks the best current value and keeps history', async () => {
    const invalid = await t.api().post(`/v1/ops/parties/${partyId}/facts`).set(bearer(admin.accessToken)).send({
      note: 'Called the owner on 9 Oct',
      facts: [{ attributeKey: TURNOVER, value: { min: 250_000_000, max: 50_000_000 } }, { attributeKey: 'business.nope', value: 1 }],
    }).expect(400);
    expect(invalid.body.details.map((detail: { path: string; code: string }) => `${detail.path}:${detail.code}`)).toEqual([
      'facts[0].value:invalid_value',
      'facts[1].attributeKey:unknown_attribute',
    ]);

    await t.prisma.borrowerFact.create({
      data: { partyId, attributeKey: TURNOVER, valueJson: { value: { min: 0, max: 49_999_999 } }, valueMin: 0, valueMax: 49_999_999, provenance: 'declared', sourceType: 'question_answer', observedAt: new Date() },
    });
    const recorded = await t.api().post(`/v1/ops/parties/${partyId}/facts`).set(bearer(admin.accessToken)).send({
      note: 'Verified from GST returns',
      facts: [{ attributeKey: TURNOVER, value: { min: 50_000_000, max: 249_999_999 } }, { attributeKey: GST, value: true }, { attributeKey: VINTAGE, value: 40 }],
    }).expect(201);
    expect(recorded.body.items).toHaveLength(3);

    const current = await t.api().get(`/v1/ops/parties/${partyId}/facts`).set(bearer(admin.accessToken)).expect(200);
    const turnover = current.body.items.find((fact: { attributeKey: string }) => fact.attributeKey === TURNOVER);
    expect(turnover).toMatchObject({ value: { min: 50_000_000, max: 249_999_999 }, provenance: 'ops_verified', sourceType: 'ops_entry', stale: false });

    const history = await t.api().get(`/v1/ops/parties/${partyId}/facts/history`).query({ attributeKey: TURNOVER, limit: 1 }).set(bearer(admin.accessToken)).expect(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.nextCursor).toBeTruthy();

    await t.api().get('/v1/ops/parties/01900000-0000-7000-8000-000000000000/facts').set(bearer(admin.accessToken)).expect(404);
  });

  it('encrypts special-category facts at rest and returns them decrypted', async () => {
    await t.api().post('/v1/admin/attributes').set(bearer(admin.accessToken)).send({
      key: 'person.disability_status', label: { en: 'Disability Status' }, dataType: 'boolean', subject: 'person', sensitivity: 'special', allowedProvenance: ['ops_verified'],
    }).expect(201);
    const person = await t.prisma.party.create({ data: { kind: PartyKind.person, displayName: 'Meera Joshi' } });
    await t.api().post(`/v1/ops/parties/${person.id}/facts`).set(bearer(admin.accessToken)).send({ note: 'Declared on call', facts: [{ attributeKey: 'person.disability_status', value: true }] }).expect(201);

    const row = await t.prisma.borrowerFact.findFirstOrThrow({ where: { partyId: person.id } });
    expect(row.valueJson).toBeNull();
    expect(row.valueEnc).toMatch(/^v1:/);
    const current = await t.api().get(`/v1/ops/parties/${person.id}/facts`).set(bearer(admin.accessToken)).expect(200);
    expect(current.body.items[0]).toMatchObject({ attributeKey: 'person.disability_status', value: true });

    const declared = await t.api().post(`/v1/ops/parties/${person.id}/facts`).set(bearer(admin.accessToken)).send({ note: 'Second entry', facts: [{ attributeKey: VINTAGE, value: 5 }] }).expect(201);
    expect(declared.body.items[0].attributeKey).toBe(VINTAGE);
  });

  it('evaluates conditions three-valued over stored facts plus an overlay', async () => {
    const condition = {
      all: [
        { attr: TURNOVER, op: 'gte', value: 50_000_000, fail: 'Turnover below 5 lakh' },
        { attr: GST, op: 'eq', value: true },
        { attr: 'borrower.has_existing_emis', op: 'eq', value: false, fail: 'Existing EMIs present' },
      ],
    };
    const unknown = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(admin.accessToken)).send({ condition, partyId }).expect(200);
    expect(unknown.body.outcome).toBe('unknown');

    const pass = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(admin.accessToken)).send({ condition, partyId, facts: { 'borrower.has_existing_emis': false } }).expect(200);
    expect(pass.body.outcome).toBe('pass');

    const fail = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(admin.accessToken)).send({ condition, partyId, facts: { 'borrower.has_existing_emis': true } }).expect(200);
    expect(fail.body.outcome).toBe('fail');
    expect(fail.body.trace.children[2]).toMatchObject({ outcome: 'fail', message: 'Existing EMIs present' });

    const higher = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(admin.accessToken)).send({
      condition: { attr: TURNOVER, op: 'gte', value: 100_000_000 }, partyId,
    }).expect(200);
    expect(higher.body.outcome).toBe('unknown');

    const invalid = await t.api().post('/v1/admin/conditions/evaluate').set(bearer(admin.accessToken)).send({ condition: { attr: GST, op: 'between', value: 1 } }).expect(400);
    expect(invalid.body.details[0].code).toBe('invalid_condition');
  });

  it('keeps fact values immutable while allowing merge re-pointing', async () => {
    const fact = await t.prisma.borrowerFact.findFirstOrThrow({ where: { partyId, attributeKey: GST } });
    await expect(t.prisma.$executeRaw`UPDATE borrower_facts SET value_json = '{"value": false}' WHERE id = ${fact.id}::uuid`).rejects.toThrow(/append-only/);
    const survivor = await t.prisma.party.create({ data: { kind: PartyKind.business, displayName: 'Shree Balaji Traders LLP' } });
    await t.prisma.borrowerFact.update({ where: { id: fact.id }, data: { partyId: survivor.id } });
    await t.prisma.borrowerFact.update({ where: { id: fact.id }, data: { partyId } });
  });

  it('lets read-only staff read but not write, and keeps borrowers out', async () => {
    const support = await createStaffSession(t, Role.support, 'Neha Kapoor');
    await t.api().get('/v1/admin/attributes').set(bearer(support.accessToken)).expect(200);
    await t.api().get(`/v1/ops/parties/${partyId}/facts`).set(bearer(support.accessToken)).expect(200);
    await t.api().post('/v1/admin/attributes').set(bearer(support.accessToken)).send({
      key: 'business.export_share', label: { en: 'Export Share' }, dataType: 'percentage', subject: 'business', sensitivity: 'financial', allowedProvenance: ['declared'],
    }).expect(403);
    await t.api().post(`/v1/ops/parties/${partyId}/facts`).set(bearer(support.accessToken)).send({ note: 'Should not work', facts: [{ attributeKey: GST, value: false }] }).expect(403);

    const borrower = await otpLogin(t, randomMobile());
    await t.api().get('/v1/admin/attributes').set(bearer(borrower.accessToken)).expect(403);
  });
});
