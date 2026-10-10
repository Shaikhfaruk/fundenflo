import { describe, expect, it } from 'vitest';

import { computeJourney, type JourneyFacts } from './journey.js';

const done: JourneyFacts = { categoryChosen: true, requirementMissing: [], preCheckRemaining: [], consentMissing: [], partiesPendingConsent: [], documentsMissing: [], detailsVerified: true, scored: true, matched: true, applied: true };

describe('application journey', () => {
  it('starts at the category and reports what blocks the current step', () => {
    expect(computeJourney({ ...done, categoryChosen: false, requirementMissing: ['amount'] })).toEqual({ stage: 'category', completed: [], blockers: [{ stage: 'category', code: 'category_missing', details: [] }] });
    expect(computeJourney({ ...done, preCheckRemaining: ['vintage', 'turnover'] })).toMatchObject({ stage: 'pre_check', completed: ['category', 'requirement'], blockers: [{ code: 'questions_unanswered', details: ['vintage', 'turnover'] }] });
    expect(computeJourney({ ...done, documentsMissing: ['bank_statement'], detailsVerified: false }).stage).toBe('documents');
  });

  it('waits for co-applicant consent after the applicant has consented', () => {
    expect(computeJourney({ ...done, consentMissing: ['credit_bureau'], partiesPendingConsent: ['row-1'] }).blockers).toEqual([{ stage: 'consent', code: 'consent_missing', details: ['credit_bureau'] }]);
    expect(computeJourney({ ...done, partiesPendingConsent: ['row-1'] }).blockers).toEqual([{ stage: 'consent', code: 'parties_consent_pending', details: ['row-1'] }]);
  });

  it('is complete only when every stage is done', () => {
    expect(computeJourney(done)).toEqual({ stage: 'apply', completed: ['category', 'requirement', 'pre_check', 'consent', 'documents', 'verify_details', 'score', 'matching', 'apply'], blockers: [] });
  });
});
