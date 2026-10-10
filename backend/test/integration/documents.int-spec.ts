import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { latestAssessmentYear } from '../../src/engines/documents/resolve-checklist.js';
import { bearer, createStaffSession, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

type Item = { key: string; label: string; description: string | null; required: boolean; anyOf: boolean; conditional: boolean; documentTypes: Array<{ key: string }> };

describe('document types, requirements and the checklist', () => {
  let t: TestApp;
  let ops: StaffSession;
  let checker: StaffSession;

  const checklist = async (query: Record<string, string | string[]>) => (await t.api().get('/v1/catalog/document-checklist').query(query).expect(200)).body as { items: Item[]; hidden: string[]; requirements: Array<{ key: string }> };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Chitra Banerjee');
    checker = await createStaffSession(t, Role.ops_lead, 'Dev Anand');
  });

  afterAll(async () => {
    await t.close();
  });

  it('builds the v0.1 app checklist from seeded requirements', async () => {
    const msme = await checklist({ segment: 'msme', category: 'lap' });
    expect(msme.items.map((item) => [item.key, item.required, item.anyOf])).toEqual([['bank_statement', true, false], ['income_proof', true, true], ['category_document', false, false]]);
    expect(msme.items[1]).toMatchObject({ label: 'ITR Or GST Returns', description: `Assessment Year ${latestAssessmentYear()} Or Last 12 Months GSTR-3B` });
    expect(msme.items[1]?.documentTypes.map((type) => type.key)).toEqual(['itr', 'gstr_3b']);
    expect(msme.items[2]).toMatchObject({ label: 'Property Papers', description: 'Sale Deed Or Title Document' });

    const home = await checklist({ segment: 'individual', category: 'home', fact: 'person.employment_type:salaried' });
    expect(home.items.map((item) => [item.key, item.conditional])).toEqual([['bank_statement', false], ['salary_slips', false], ['category_document', false]]);
    expect(home.items[2]?.description).toBe('Sale Agreement Or Allotment Letter');
    expect(home.hidden).toEqual(['income_proof']);

    const unknown = await checklist({ segment: 'individual' });
    expect(unknown.items.filter((item) => item.conditional).map((item) => item.key)).toEqual(['salary_slips', 'income_proof']);
    expect((await checklist({ segment: 'msme', stage: 'submission' })).items).toEqual([]);
    const badFact = await t.api().get('/v1/catalog/document-checklist').query({ segment: 'individual', fact: ['person.employment_type:retired', 'nope.attr:1'] }).expect(400);
    expect(badFact.body.details.map((issue: { code: string }) => issue.code)).toEqual(['invalid_value', 'unknown_attribute']);
  });

  it('manages document types and rejects unknown placeholders and attributes', async () => {
    const list = await t.api().get('/v1/admin/document-types').set(bearer(ops.accessToken)).expect(200);
    expect(list.body.items.map((type: { key: string }) => type.key)).toEqual(expect.arrayContaining(['bank_statement', 'itr', 'gstr_3b', 'salary_slip', 'pan']));
    const base = { key: 'export_invoices', label: { en: 'Export Invoices' }, acceptedMimeTypes: ['application/pdf'], maxSizeBytes: 5_000_000, sensitivity: 'financial' };
    const placeholder = await t.api().post('/v1/admin/document-types').set(bearer(ops.accessToken)).send({ ...base, description: { en: 'For {{financialYear}}' } }).expect(400);
    expect(placeholder.body.details[0]).toMatchObject({ path: 'description.en', code: 'unknown_placeholder' });
    await t.api().post('/v1/admin/document-types').set(bearer(ops.accessToken)).send({ ...base, producesAttributes: ['business.no_such_thing'] }).expect(400);
    const created = await t.api().post('/v1/admin/document-types').set(bearer(ops.accessToken)).send({ ...base, description: { en: 'Last 6 Months Of Export Invoices' }, periodRule: 'last_6_months', producesAttributes: ['business.monthly_turnover_paise'] }).expect(201);
    const updated = await t.api().patch(`/v1/admin/document-types/${created.body.id}`).set(bearer(ops.accessToken)).set('If-Match', `"${created.body.version}"`).send({ maxSizeBytes: 8_000_000 }).expect(200);
    expect(updated.body).toMatchObject({ maxSizeBytes: 8_000_000, version: 2 });
    await t.api().patch(`/v1/admin/document-types/${created.body.id}`).set(bearer(ops.accessToken)).set('If-Match', '"1"').send({ icon: 'receipt' }).expect(409);
    const support = await createStaffSession(t, Role.support, 'Esha Gupta');
    await t.api().post('/v1/admin/document-types').set(bearer(support.accessToken)).send({ ...base, key: 'not_allowed' }).expect(403);
  });

  it('publishes a new requirement through maker-checker and applies it with conditions', async () => {
    const bad = await t.api().post('/v1/admin/document-requirements').set(bearer(ops.accessToken)).send({
      key: 'assessment.bad',
      name: { en: 'Broken requirement' },
      content: { stage: 'assessment', scope: { segments: ['spaceships'] }, items: [{ key: 'thing', documentTypes: ['no_such_type'], when: { attr: 'nope.attr', op: 'eq', value: 1 } }] },
    }).expect(201);
    const refused = await t.api().post(`/v1/admin/document-requirements/${bad.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Trying a broken one' }).expect(400);
    expect(refused.body.details.map((issue: { code: string }) => issue.code).toSorted((left: string, right: string) => left.localeCompare(right))).toEqual(['invalid_condition', 'unknown_document_type', 'unknown_key']);

    const requirement = await t.api().post('/v1/admin/document-requirements').set(bearer(ops.accessToken)).send({
      key: 'assessment.msme.gst',
      name: { en: 'GST registered businesses' },
      content: { stage: 'assessment', scope: { segments: ['msme'], categories: ['business'] }, items: [{ key: 'gst_returns', documentTypes: ['gstr_3b'], minCount: 12, when: { attr: 'business.gst_registered', op: 'eq', value: true } }] },
    }).expect(201);
    const submitted = await t.api().post(`/v1/admin/document-requirements/${requirement.body.id}/versions/1/submit`).set(bearer(ops.accessToken)).send({ reason: 'Lenders ask for 12 months of GSTR-3B' }).expect(200);
    await t.api().post(`/v1/admin/change-requests/${submitted.body.changeRequest.id}/approve`).set(bearer(checker.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/document-requirements/${requirement.body.id}/versions/1/publish`).set(bearer(ops.accessToken)).send({}).expect(200);

    const registered = await checklist({ segment: 'msme', category: 'business', fact: 'business.gst_registered:true' });
    expect(registered.items.find((item) => item.key === 'gst_returns')).toMatchObject({ required: true, conditional: false, label: 'GST Returns' });
    expect(registered.requirements.map((entry) => entry.key)).toContain('assessment.msme.gst');
    const notRegistered = await checklist({ segment: 'msme', category: 'business', fact: 'business.gst_registered:false' });
    expect(notRegistered.hidden).toContain('gst_returns');
  });
});
