import { describe, expect, it } from 'vitest';

import type { FactLookup } from '../conditions/condition.types.js';
import type { ActiveDocumentRequirement, DocumentSlot } from './documents.types.js';
import { FileMimeType, sniffMimeType } from './file-signature.js';
import { latestAssessmentYear, resolveChecklist } from './resolve-checklist.js';
import { satisfyChecklist } from './satisfy-checklist.js';

const slot = (key: string, documentTypes: string[], extra: Partial<DocumentSlot> = {}): DocumentSlot => ({ key, documentTypes, required: true, minCount: 1, when: null, label: null, description: null, ...extra });

const salaried = { attr: 'person.employment_type', op: 'eq', value: 'salaried' } as const;

const REQUIREMENTS: ActiveDocumentRequirement[] = [
  { key: 'assessment.base', versionId: 'v1', requirement: { stage: 'assessment', scope: {}, items: [slot('bank_statement', ['bank_statement'])] } },
  { key: 'assessment.msme', versionId: 'v2', requirement: { stage: 'assessment', scope: { segments: ['msme'] }, items: [slot('income_proof', ['itr', 'gstr_3b'])] } },
  {
    key: 'assessment.individual',
    versionId: 'v3',
    requirement: { stage: 'assessment', scope: { segments: ['individual'] }, items: [slot('salary_slips', ['salary_slip'], { minCount: 3, when: salaried }), slot('income_proof', ['itr'], { when: { attr: 'person.employment_type', op: 'neq', value: 'salaried' } })] },
  },
  { key: 'assessment.lap', versionId: 'v4', requirement: { stage: 'assessment', scope: { categories: ['lap'] }, items: [slot('property', ['property_papers'], { required: false })] } },
  { key: 'submission.base', versionId: 'v5', requirement: { stage: 'submission', scope: {}, items: [slot('pan', ['pan'])] } },
];

const facts = (values: Record<string, string>): FactLookup => (attr) => values[attr];

describe('document checklist', () => {
  it('merges generic and specific requirements for the stage, required first, with any-of groups', () => {
    const checklist = resolveChecklist(REQUIREMENTS, { stage: 'assessment', segment: 'msme', category: 'lap' }, facts({}));
    expect(checklist.items.map((item) => [item.key, item.documentTypes, item.required])).toEqual([
      ['bank_statement', ['bank_statement'], true],
      ['income_proof', ['itr', 'gstr_3b'], true],
      ['property', ['property_papers'], false],
    ]);
    expect(checklist.requirements.map((entry) => entry.key)).toEqual(['assessment.base', 'assessment.lap', 'assessment.msme']);
  });

  it('applies conditions on facts, keeping unknown ones as conditional', () => {
    const known = resolveChecklist(REQUIREMENTS, { stage: 'assessment', segment: 'individual' }, facts({ 'person.employment_type': 'salaried' }));
    expect(known.items.map((item) => item.key)).toEqual(['bank_statement', 'salary_slips']);
    expect(known.hidden).toEqual(['income_proof']);
    const unknown = resolveChecklist(REQUIREMENTS, { stage: 'assessment', segment: 'individual' });
    expect(unknown.items.filter((item) => item.applicability === 'unknown').map((item) => item.key)).toEqual(['salary_slips', 'income_proof']);
  });

  it('lets a more specific requirement replace a slot and records who needs it', () => {
    const override: ActiveDocumentRequirement = { key: 'assessment.msme.lap', versionId: 'v6', requirement: { stage: 'assessment', scope: { segments: ['msme'], categories: ['lap'] }, items: [slot('income_proof', ['itr'], { minCount: 2 })] } };
    const checklist = resolveChecklist([...REQUIREMENTS, override], { stage: 'assessment', segment: 'msme', category: 'lap' });
    expect(checklist.items.find((item) => item.key === 'income_proof')).toMatchObject({ documentTypes: ['itr'], minCount: 2, requirementKey: 'assessment.msme.lap', neededBy: ['assessment.msme', 'assessment.msme.lap'] });
  });

  it('names the latest assessment year for ITR', () => {
    expect(latestAssessmentYear(new Date('2026-10-10T00:00:00Z'))).toBe('2026–27');
    expect(latestAssessmentYear(new Date('2027-02-01T00:00:00Z'))).toBe('2026–27');
  });
});

const bytes = (...values: number[]) => Uint8Array.from(values);

const text = (value: string) => new TextEncoder().encode(value);

describe('file type sniffing', () => {
  it('recognises files by their content, not their name', () => {
    expect(sniffMimeType(text('%PDF-1.7\n1 0 obj'), { fileName: 'statement.png' })).toBe(FileMimeType.Pdf);
    expect(sniffMimeType(text('\r\n%PDF-1.4'))).toBe(FileMimeType.Pdf);
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe(FileMimeType.Jpeg);
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(FileMimeType.Png);
    expect(sniffMimeType(Uint8Array.from([0, 0, 0, 0x18, ...text('ftypheic'), 0, 0, 0, 0]))).toBe(FileMimeType.Heic);
    expect(sniffMimeType(text('MZ\x90 not a document'), { fileName: 'statement.pdf' })).toBeNull();
    expect(sniffMimeType(new Uint8Array())).toBeNull();
  });

  it('accepts zip and text formats only when the name or declared type says so', () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0);
    expect(sniffMimeType(zip, { fileName: 'turnover.xlsx' })).toBe(FileMimeType.Xlsx);
    expect(sniffMimeType(zip, { fileName: 'archive.zip' })).toBeNull();
    expect(sniffMimeType(text('date,amount\n2026-04-01,1200\n'), { declared: 'text/csv' })).toBe(FileMimeType.Csv);
    expect(sniffMimeType(text('date,amount'), { fileName: 'notes.txt' })).toBeNull();
    expect(sniffMimeType(Uint8Array.from([...text('a,b'), 0, 1]), { fileName: 'rows.csv' })).toBeNull();
    expect(sniffMimeType(Uint8Array.from([...text('naam,rakam\n'), 0xe0, 0xa4]), { fileName: 'rows.csv' })).toBe(FileMimeType.Csv);
  });
});

describe('checklist satisfaction', () => {
  const slots = [
    { key: 'bank_statement', documentTypes: ['bank_statement'], minCount: 1 },
    { key: 'income_proof', documentTypes: ['itr', 'gstr_3b'], minCount: 1 },
    { key: 'gst_returns', documentTypes: ['gstr_3b'], minCount: 3 },
  ];
  const now = new Date('2026-10-10T00:00:00Z');

  it('counts fresh documents of any accepted type against each slot', () => {
    const result = satisfyChecklist(
      slots,
      [
        { id: 'a', documentType: 'bank_statement', freshUntil: new Date('2026-09-01T00:00:00Z') },
        { id: 'b', documentType: 'gstr_3b', freshUntil: null },
        { id: 'c', documentType: 'gstr_3b', freshUntil: null },
      ],
      now,
    );
    expect(result.get('bank_statement')).toEqual({ key: 'bank_statement', satisfied: false, count: 0, documentIds: [] });
    expect(result.get('income_proof')).toMatchObject({ satisfied: true, documentIds: ['b', 'c'] });
    expect(result.get('gst_returns')).toMatchObject({ satisfied: false, count: 2 });
  });
});
