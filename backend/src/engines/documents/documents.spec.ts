import { describe, expect, it } from 'vitest';

import type { FactLookup } from '../conditions/condition.types.js';
import type { ActiveDocumentRequirement, DocumentSlot } from './documents.types.js';
import { latestAssessmentYear, resolveChecklist } from './resolve-checklist.js';

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
