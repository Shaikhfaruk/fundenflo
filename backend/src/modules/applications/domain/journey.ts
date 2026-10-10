export const JourneyStage = {
  Category: 'category',
  Requirement: 'requirement',
  PreCheck: 'pre_check',
  Consent: 'consent',
  Documents: 'documents',
  VerifyDetails: 'verify_details',
  Score: 'score',
  Matching: 'matching',
  Apply: 'apply',
} as const;

export type JourneyStage = (typeof JourneyStage)[keyof typeof JourneyStage];

export const JOURNEY_ORDER: readonly JourneyStage[] = Object.values(JourneyStage);

export type JourneyBlocker = { stage: JourneyStage; code: string; details: string[] };

export type JourneyFacts = {
  categoryChosen: boolean;
  requirementMissing: string[];
  preCheckRemaining: string[];
  consentMissing: string[];
  documentsMissing: string[];
  detailsVerified: boolean;
  scored: boolean;
  matched: boolean;
  applied: boolean;
};

const list = (stage: JourneyStage, code: string, details: string[]): JourneyBlocker | null => (details.length === 0 ? null : { stage, code, details });

const flag = (stage: JourneyStage, code: string, ok: boolean): JourneyBlocker | null => (ok ? null : { stage, code, details: [] });

const BLOCKERS: Record<JourneyStage, (facts: JourneyFacts) => JourneyBlocker | null> = {
  [JourneyStage.Category]: (facts) => flag(JourneyStage.Category, 'category_missing', facts.categoryChosen),
  [JourneyStage.Requirement]: (facts) => list(JourneyStage.Requirement, 'requirement_incomplete', facts.requirementMissing),
  [JourneyStage.PreCheck]: (facts) => list(JourneyStage.PreCheck, 'questions_unanswered', facts.preCheckRemaining),
  [JourneyStage.Consent]: (facts) => list(JourneyStage.Consent, 'consent_missing', facts.consentMissing),
  [JourneyStage.Documents]: (facts) => list(JourneyStage.Documents, 'documents_missing', facts.documentsMissing),
  [JourneyStage.VerifyDetails]: (facts) => flag(JourneyStage.VerifyDetails, 'details_unverified', facts.detailsVerified),
  [JourneyStage.Score]: (facts) => flag(JourneyStage.Score, 'not_scored', facts.scored),
  [JourneyStage.Matching]: (facts) => flag(JourneyStage.Matching, 'not_matched', facts.matched),
  [JourneyStage.Apply]: (facts) => flag(JourneyStage.Apply, 'not_applied', facts.applied),
};

export function computeJourney(facts: JourneyFacts) {
  const completed: JourneyStage[] = [];
  for (const stage of JOURNEY_ORDER) {
    const blocker = BLOCKERS[stage](facts);
    if (blocker) return { stage, completed, blockers: [blocker] };
    completed.push(stage);
  }
  return { stage: JourneyStage.Apply, completed, blockers: [] };
}
