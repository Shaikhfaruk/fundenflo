import { ApplicationStatus, LeadLostReason, LeadSourceKind } from '../../../common/enums/db.enums.js';

export const LEAD_QUALITY_WEIGHTS = {
  mobile: 25,
  email: 5,
  name: 10,
  segment: 10,
  category: 15,
  amount: 10,
  location: 15,
  consent: 10,
} as const;

export const LeadSourceKey = {
  Manual: 'manual',
  Import: 'import',
  AppDropoff: 'app_dropoff',
  PartnerReferral: 'partner_referral',
  ReferralCode: 'referral_code',
} as const;

export type LeadSourceKey = (typeof LeadSourceKey)[keyof typeof LeadSourceKey];

export const SYSTEM_LEAD_SOURCES: Array<{ key: LeadSourceKey; name: string; kind: LeadSourceKind }> = [
  { key: LeadSourceKey.Manual, name: 'Ops manual entry', kind: LeadSourceKind.manual },
  { key: LeadSourceKey.Import, name: 'Backlog and file imports', kind: LeadSourceKind.import },
  { key: LeadSourceKey.AppDropoff, name: 'App users who stopped mid-journey', kind: LeadSourceKind.app_dropoff },
  { key: LeadSourceKey.PartnerReferral, name: 'Referred by a partner firm', kind: LeadSourceKind.partner_referral },
  { key: LeadSourceKey.ReferralCode, name: 'Signed up with a partner referral code', kind: LeadSourceKind.partner_referral },
];

export const LEAD_SOURCE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export const LEAD_DUPLICATE_WINDOW_DAYS = 30;

export const LEAD_REF_PREFIX = 'LD';

export const LEAD_TEXT_MAX_LENGTH = 200;

export const LEAD_NOTE_MAX_LENGTH = 1_000;

export const LEAD_MERGE_MAX = 20;

export const LEAD_EVENTS_IN_DETAIL = 50;

export const LEAD_REPORT_DEFAULT_DAYS = 30;

export const LEAD_REPORT_MAX_DAYS = 366;

export const LEAD_RAW_PAYLOAD_MAX_BYTES = 32_000;

export const DEFAULT_LEAD_CONSENT_CONTEXT = 'lead_capture';

export const DROPOFF_CHECK_JOB = 'check';

export const LEAD_IMPORT_FIELDS = [
  { key: 'name', label: 'Name', description: 'Person\'s full name' },
  { key: 'mobile', label: 'Mobile', description: 'Mobile number, with or without +91' },
  { key: 'countryCode', label: 'Country code', description: 'Calling code when numbers are local, e.g. +91' },
  { key: 'email', label: 'Email', description: 'Email address' },
  { key: 'landline', label: 'Landline', description: 'Landline number with STD code' },
  { key: 'businessName', label: 'Business name', description: 'Firm or company name for business enquiries' },
  { key: 'segment', label: 'Segment', description: 'Segment key such as msme or individual' },
  { key: 'subSegment', label: 'Sub-segment', description: 'Constitution or employment key' },
  { key: 'category', label: 'Loan category', description: 'Category key or a known alias such as "business loan"' },
  { key: 'purpose', label: 'Purpose', description: 'Purpose key, or free text kept as a note' },
  { key: 'amount', label: 'Amount', description: 'Amount in rupees or text such as "20-25 lakh"' },
  { key: 'tenureMonths', label: 'Tenure (months)', description: 'Whole number of months' },
  { key: 'city', label: 'City', description: 'City name; aliases such as Gurgaon are understood' },
  { key: 'pincode', label: 'Pincode', description: '6-digit pincode' },
  { key: 'urgency', label: 'Urgency', description: 'immediate, within_month or exploring' },
  { key: 'preferredLanguage', label: 'Language', description: 'Two-letter language code such as hi' },
  { key: 'preferredContactTime', label: 'Contact time', description: 'Preferred time to call' },
  { key: 'campaign', label: 'Campaign', description: 'Campaign or list name' },
  { key: 'externalRef', label: 'External id', description: 'Your own row id; re-importing the same id does not create a second lead' },
  { key: 'consentGiven', label: 'Consent given', description: 'yes / no column; consent defaults apply only to yes rows when mapped' },
  { key: 'consentEvidence', label: 'Consent evidence', description: 'Per-row evidence text, overriding the default evidence' },
] as const;

export const TRUTHY_CELL = /^(y|yes|true|1|agreed|consented)$/i;

export const LEAD_CLOSE_FOR_APPLICATION: Partial<Record<ApplicationStatus, LeadLostReason | null>> = {
  [ApplicationStatus.closed_won]: null,
  [ApplicationStatus.closed_lost]: LeadLostReason.not_eligible,
  [ApplicationStatus.withdrawn]: LeadLostReason.not_interested,
  [ApplicationStatus.expired]: LeadLostReason.other,
};

export const ReferralOutcome = {
  AlreadyAttributed: 'already_attributed',
  Disputed: 'disputed',
  Attributed: 'attributed',
} as const;

export type ReferralOutcome = (typeof ReferralOutcome)[keyof typeof ReferralOutcome];
