export const JourneyMode = { Borrower: 'borrower', Partner: 'partner' } as const;

export type JourneyMode = (typeof JourneyMode)[keyof typeof JourneyMode];

const JourneyStage = {
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

export const JOURNEY_ORDER: readonly string[] = Object.values(JourneyStage);

export const JourneyScreen = {
  Requirement: 'requirement',
  Questions: 'questions',
  People: 'people',
  Consents: 'consents',
  Documents: 'documents',
  Verify: 'verify',
  Analysis: 'analysis',
  Score: 'score',
  Improve: 'improve',
  Lenders: 'lenders',
  Submissions: 'submissions',
} as const;

export type JourneyScreen = (typeof JourneyScreen)[keyof typeof JourneyScreen];

export const JOURNEY_TOTAL_STEPS = 6;

export const START_STEP = { who: 1, what: 2 } as const;

export const JOURNEY_SCREEN_STEP: Record<JourneyScreen, number> = {
  [JourneyScreen.Requirement]: 2,
  [JourneyScreen.Questions]: 3,
  [JourneyScreen.People]: 4,
  [JourneyScreen.Consents]: 4,
  [JourneyScreen.Documents]: 5,
  [JourneyScreen.Verify]: 5,
  [JourneyScreen.Analysis]: 5,
  [JourneyScreen.Score]: 6,
  [JourneyScreen.Improve]: 6,
  [JourneyScreen.Lenders]: 6,
  [JourneyScreen.Submissions]: 6,
};

const BlockerCode = {
  PartiesConsentPending: 'parties_consent_pending',
} as const;

export const screenForStage = (stage: string | null | undefined, blockerCode?: string): JourneyScreen | null => {
  if (stage === JourneyStage.Requirement || stage === JourneyStage.Category) return JourneyScreen.Requirement;
  if (stage === JourneyStage.PreCheck) return JourneyScreen.Questions;
  if (stage === JourneyStage.Consent) return blockerCode === BlockerCode.PartiesConsentPending ? JourneyScreen.People : JourneyScreen.Consents;
  if (stage === JourneyStage.Documents) return JourneyScreen.Documents;
  if (stage === JourneyStage.VerifyDetails) return JourneyScreen.Verify;
  if (stage === JourneyStage.Score) return JourneyScreen.Score;
  if (stage === JourneyStage.Matching) return JourneyScreen.Lenders;
  if (stage === JourneyStage.Apply) return blockerCode ? JourneyScreen.Lenders : JourneyScreen.Submissions;
  return null;
};

export const MatchOutcome = { Eligible: 'eligible', NeedsInfo: 'needs_info' } as const;

export const SUBMISSION_WITHDRAW_MIN_LENGTH = 3;

export const SUBMISSION_WITHDRAW_MAX_LENGTH = 1_000;

export const APPLICATION_WITHDRAW_MAX_LENGTH = 500;

export const UpdateChannel = { Sms: 'sms', Push: 'push' } as const;

export const UpdateEvent = { AnalysisCompleted: 'analysis.completed', ApplicationStatusChanged: 'application.status_changed', SubmissionStatusChanged: 'submission.status_changed' } as const;

export const QuestionStage = { PreCheck: 'pre_check' } as const;

export const QuestionKind = {
  SingleSelect: 'single_select',
  MultiSelect: 'multi_select',
  Number: 'number',
  Money: 'money',
  Date: 'date',
  Text: 'text',
  Boolean: 'boolean',
  City: 'city',
  Pincode: 'pincode',
} as const;

export const HIDDEN_VISIBILITY = 'fail';

export const JOURNEY_CONSENT_CONTEXT = 'journey';

export const CoPartyRole = { CoApplicant: 'co_applicant', Guarantor: 'guarantor', Director: 'director' } as const;

export const CO_PARTY_ROLES: readonly string[] = Object.values(CoPartyRole);

export const PARTY_RELATIONSHIPS = ['spouse', 'parent', 'child', 'sibling', 'relative', 'business_partner', 'director', 'friend', 'other'] as const;

export const PartyKind = { Business: 'business', Person: 'person' } as const;

export const PartyConsentStatus = { Pending: 'pending', Granted: 'granted', Declined: 'declined' } as const;

export const PURPOSE_NOTE_MIN_LENGTH = 2;

export const PURPOSE_NOTE_MAX_LENGTH = 500;

export const CITY_SEARCH_MIN_LENGTH = 2;

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const MONTHS_PER_YEAR = 12;

export const BUSINESS_SEGMENT = 'msme';
