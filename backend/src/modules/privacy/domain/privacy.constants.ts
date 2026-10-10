export const PRIVACY_PARTICIPANT_METADATA = 'privacy:participant';

export const PrivacySection = {
  Answers: 'answers',
  Facts: 'facts',
  Documents: 'documents',
  Leads: 'leads',
  Consents: 'consents',
  Borrowers: 'borrower_profiles',
  Applications: 'applications',
  Sharing: 'shared_with_lenders',
  Account: 'account',
  Profile: 'profile',
} as const;

export type PrivacySection = (typeof PrivacySection)[keyof typeof PrivacySection];

export const ERASURE_ORDER: readonly PrivacySection[] = [
  PrivacySection.Answers,
  PrivacySection.Facts,
  PrivacySection.Documents,
  PrivacySection.Leads,
  PrivacySection.Consents,
  PrivacySection.Borrowers,
  PrivacySection.Applications,
  PrivacySection.Sharing,
  PrivacySection.Account,
  PrivacySection.Profile,
];

export const DATA_REQUEST_DUE_DAYS = 30;

export const DATA_EXPORT_TTL_DAYS = 7;

export const DATA_EXPORT_READ_URL_TTL_SECONDS = 300;

export const DATA_EXPORT_KEY_PREFIX = 'privacy-exports';

export const DATA_EXPORT_CONTENT_TYPE = 'application/json';

export const DATA_REQUEST_DETAILS_MAX_LENGTH = 2_000;

export const DATA_REQUESTS_LIMIT = 50;

export const DATA_EXPORT_FORMAT = 1;

export const ERASURE_EVIDENCE = 'Withdrawn on a data erasure request';
