import ExcelJS from 'exceljs';
import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '../../src/common/enums/db.enums.js';
import { ImportService } from '../../src/modules/imports/application/import.service.js';
import { ImportJob } from '../../src/modules/imports/domain/import.constants.js';
import { bearer, createStaffSession, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const upload = async (url: string, contentType: string, body: Buffer | string) => {
  const response = await fetch(url, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType }, body });
  expect(response.status).toBe(201);
};

describe('lead imports', () => {
  let t: TestApp;
  let ops: StaffSession;
  const existingMobile = randomMobile();

  const run = (id: string, job: ImportJob) => t.app.get(ClsService).run(() => t.app.get(ImportService).run(id, job));
  const create = async (fileName: string) => (await t.api().post('/v1/admin/imports').set(bearer(ops.accessToken)).send({ kind: 'leads', fileName }).expect(201)).body;

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Harish Menon');
    await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ name: 'Old Customer', mobile: existingMobile, category: 'personal' }).expect(201);
  });

  afterAll(async () => {
    await t.close();
  });

  it('imports a backlog CSV: upload, inspect, map, validate with row errors, commit and undo', async () => {
    const fields = await t.api().get('/v1/admin/imports/fields/leads').set(bearer(ops.accessToken)).expect(200);
    expect(fields.body.fields.map((field: { key: string }) => field.key)).toContain('mobile');

    const created = await create('october-backlog.csv');
    expect(created.batch).toMatchObject({ kind: 'leads', status: 'awaiting_upload' });
    expect(created.upload).toMatchObject({ method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/csv' } });
    const id: string = created.batch.id;
    await t.api().post(`/v1/admin/imports/${id}/inspect`).set(bearer(ops.accessToken)).expect(400).expect((response) => expect(response.body.details[0].code).toBe('not_uploaded'));

    const second = randomMobile();
    const csv = [
      'Customer Name,Phone,Business,Loan Type,Amount Needed,City,Consent?,Ref',
      `Ramesh Kumar,${randomMobile()},Kumar Traders,business loan,20-25 lakh,Gurgaon,yes,ROW-1`,
      `Sunita Devi,${second},,personal,5 lakh,Pune,no,ROW-2`,
      'No Phone,,,,,Delhi,yes,ROW-3',
      `Repeat Sunita,${second},,personal,,Pune,no,ROW-4`,
      `Old Customer,${existingMobile},,home,1.5 cr,Atlantis,yes,ROW-5`,
    ].join('\n');
    await upload(created.upload.url, 'text/csv', csv);

    const inspected = await t.api().post(`/v1/admin/imports/${id}/inspect`).set(bearer(ops.accessToken)).expect(200);
    expect(inspected.body).toMatchObject({ status: 'uploaded', columns: ['Customer Name', 'Phone', 'Business', 'Loan Type', 'Amount Needed', 'City', 'Consent?', 'Ref'] });
    expect(inspected.body.sampleRows[0]).toMatchObject({ 'Customer Name': 'Ramesh Kumar', 'Loan Type': 'business loan' });
    const stored = await t.prisma.importBatch.findUniqueOrThrow({ where: { id } });
    expect(stored.sampleRowsEnc).toMatch(/^v1:/);

    const badMapping = await t.api().put(`/v1/admin/imports/${id}/mapping`).set(bearer(ops.accessToken)).send({ mapping: { mobile: 'Mobile No', shoeSize: 'Phone' }, defaults: { source: 'nope' } }).expect(400);
    expect(badMapping.body.details.map((detail: { code: string }) => detail.code).toSorted()).toEqual(['inactive_source', 'unknown_column', 'unknown_field']);
    const mapping = { name: 'Customer Name', mobile: 'Phone', businessName: 'Business', category: 'Loan Type', amount: 'Amount Needed', city: 'City', consentGiven: 'Consent?', externalRef: 'Ref' };
    const defaults = { segment: 'msme', campaign: 'Backlog 2025', consent: { basis: 'consent', evidence: 'Website form checkbox, 2025 campaign', purposes: ['contact', 'partner_sharing'] } };
    await t.api().put(`/v1/admin/imports/${id}/mapping`).set(bearer(ops.accessToken)).send({ mapping, defaults }).expect(200);

    await t.api().post(`/v1/admin/imports/${id}/commit`).set(bearer(ops.accessToken)).expect(409);
    const started = await t.api().post(`/v1/admin/imports/${id}/validate`).set(bearer(ops.accessToken)).expect(202);
    expect(started.body.status).toBe('validating');
    await run(id, ImportJob.Validate);
    const validated = await t.api().get(`/v1/admin/imports/${id}`).set(bearer(ops.accessToken)).expect(200);
    expect(validated.body).toMatchObject({ status: 'validated', counts: { total: 5, valid: 4, invalid: 1 }, summary: { warnings: { duplicate_in_file: 1, existing_person: 1 } } });
    const errors = await t.api().get(`/v1/admin/imports/${id}/errors`).set(bearer(ops.accessToken)).expect(200);
    expect(errors.body.items).toEqual([expect.objectContaining({ rowNumber: 4, status: 'invalid', values: expect.objectContaining({ 'Customer Name': 'No Phone' }) })]);
    expect(errors.body.items[0].issues.errors[0]).toMatchObject({ field: 'mobile', code: 'contact_required' });

    await t.api().post(`/v1/admin/imports/${id}/commit`).set(bearer(ops.accessToken)).expect(202);
    await run(id, ImportJob.Commit);
    const committed = await t.api().get(`/v1/admin/imports/${id}`).set(bearer(ops.accessToken)).expect(200);
    expect(committed.body).toMatchObject({ status: 'committed', counts: { committed: 4, failed: 0 } });

    const leads = await t.prisma.lead.findMany({ where: { importBatchId: id }, orderBy: { importRowNumber: 'asc' } });
    expect(leads.map((lead) => [lead.importRowNumber, lead.consentStatus, lead.categoryKey, lead.campaign])).toEqual([
      [2, 'ok', 'business', 'Backlog 2025'],
      [3, 'pending', 'personal', 'Backlog 2025'],
      [5, 'pending', 'personal', 'Backlog 2025'],
      [6, 'ok', 'home', 'Backlog 2025'],
    ]);
    expect(leads[2]?.flags).toEqual(['duplicate']);
    expect(leads[3]?.flags).toEqual(['unmapped_location']);
    const consent = await t.prisma.consentRecord.findFirstOrThrow({ where: { leadId: leads[0]?.id } });
    expect(consent).toMatchObject({ channel: 'import', basis: 'consent', evidence: 'Website form checkbox, 2025 campaign' });
    const lead = await t.api().get(`/v1/ops/leads/${leads[0]?.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(lead.body).toMatchObject({ source: { key: 'import' }, importRowNumber: 2, capturedByUserId: ops.user.id, externalRef: 'ROW-1' });

    await t.api().post(`/v1/ops/leads/${leads[1]?.id}/qualify`).set(bearer(ops.accessToken)).send({}).expect(200);
    await t.api().post(`/v1/admin/imports/${id}/undo`).set(bearer(ops.accessToken)).expect(202);
    await run(id, ImportJob.Undo);
    const undone = await t.api().get(`/v1/admin/imports/${id}`).set(bearer(ops.accessToken)).expect(200);
    expect(undone.body).toMatchObject({ status: 'undone', counts: { undone: 3 } });
    const after = await t.prisma.lead.findMany({ where: { importBatchId: id }, orderBy: { importRowNumber: 'asc' } });
    expect(after.map((row) => `${row.status}:${row.unqualifiedReason ?? ''}`)).toEqual(['unqualified:import_undone', 'qualified:', 'unqualified:import_undone', 'unqualified:import_undone']);
  });

  it('reads XLSX files and re-imports by external id without duplicating leads', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.addRow(['Name', 'Mobile', 'Ref']);
    sheet.addRow(['Farida Khan', Number(randomMobile()), 'XL-1']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const ids: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const created = await create('partner-list.xlsx');
      await upload(created.upload.url, created.upload.headers['Content-Type'], buffer);
      await t.api().post(`/v1/admin/imports/${created.batch.id}/inspect`).set(bearer(ops.accessToken)).expect(200);
      await t.api().put(`/v1/admin/imports/${created.batch.id}/mapping`).set(bearer(ops.accessToken)).send({ mapping: { name: 'Name', mobile: 'Mobile', externalRef: 'Ref' } }).expect(200);
      await t.api().post(`/v1/admin/imports/${created.batch.id}/validate`).set(bearer(ops.accessToken)).expect(202);
      await run(created.batch.id, ImportJob.Validate);
      await t.api().post(`/v1/admin/imports/${created.batch.id}/commit`).set(bearer(ops.accessToken)).expect(202);
      await run(created.batch.id, ImportJob.Commit);
      ids.push(created.batch.id);
    }
    const leads = await t.prisma.lead.findMany({ where: { externalRef: 'XL-1' } });
    expect(leads).toHaveLength(1);
    expect(leads[0]?.importBatchId).toBe(ids[0]);
    await t.api().post(`/v1/admin/imports/${ids[1]}/undo`).set(bearer(ops.accessToken)).expect(202);
    await run(ids[1] as string, ImportJob.Undo);
    expect((await t.prisma.lead.findUniqueOrThrow({ where: { id: leads[0]?.id } })).status).toBe('new');

    const list = await t.api().get('/v1/admin/imports').query({ status: 'undone' }).set(bearer(ops.accessToken)).expect(200);
    expect(list.body.items.map((batch: { id: string }) => batch.id)).toContain(ids[1]);
    await t.api().post('/v1/admin/imports').set(bearer(ops.accessToken)).send({ kind: 'leads', fileName: 'leads.pdf' }).expect(400);
  });
});
