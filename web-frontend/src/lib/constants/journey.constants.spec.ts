import { describe, expect, it } from 'vitest';

import { JourneyScreen, screenForStage } from './journey.constants';

describe('screenForStage', () => {
  it('opens the screen that clears each journey stage', () => {
    expect(screenForStage('category')).toBe(JourneyScreen.Requirement);
    expect(screenForStage('pre_check')).toBe(JourneyScreen.Questions);
    expect(screenForStage('consent', 'parties_consent_pending')).toBe(JourneyScreen.People);
    expect(screenForStage('consent', 'consent_missing')).toBe(JourneyScreen.Consents);
    expect(screenForStage('documents', 'documents_missing')).toBe(JourneyScreen.Documents);
    expect(screenForStage('verify_details', 'details_unverified')).toBe(JourneyScreen.Verify);
    expect(screenForStage('score', 'not_scored')).toBe(JourneyScreen.Score);
    expect(screenForStage('matching', 'not_matched')).toBe(JourneyScreen.Lenders);
  });

  it('sends an applied case to its submissions and an unapplied one to the lenders', () => {
    expect(screenForStage('apply', 'not_applied')).toBe(JourneyScreen.Lenders);
    expect(screenForStage('apply')).toBe(JourneyScreen.Submissions);
    expect(screenForStage(null)).toBeNull();
  });
});
