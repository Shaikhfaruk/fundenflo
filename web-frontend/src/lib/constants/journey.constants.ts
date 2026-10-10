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
} as const;

export type JourneyScreen = (typeof JourneyScreen)[keyof typeof JourneyScreen];

export const JOURNEY_TOTAL_STEPS = 6;

export const START_STEP = { who: 1, what: 2 } as const;

export const JOURNEY_SCREEN_STEP: Record<JourneyScreen, number> = {
  [JourneyScreen.Requirement]: 2,
  [JourneyScreen.Questions]: 3,
  [JourneyScreen.People]: 4,
  [JourneyScreen.Consents]: 4,
};

const BlockerCode = {
  PartiesConsentPending: 'parties_consent_pending',
} as const;

export const screenForStage = (stage: string | null | undefined, blockerCode?: string): JourneyScreen | null => {
  if (stage === JourneyStage.Requirement || stage === JourneyStage.Category) return JourneyScreen.Requirement;
  if (stage === JourneyStage.PreCheck) return JourneyScreen.Questions;
  if (stage === JourneyStage.Consent) return blockerCode === BlockerCode.PartiesConsentPending ? JourneyScreen.People : JourneyScreen.Consents;
  return null;
};

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
