export const PartnerKind = {
  Ca: 'ca',
  Dsa: 'dsa',
  Connector: 'connector',
} as const;

export const SERVICE_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'or'] as const;

export const PartnerVerificationStatus = {
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;

export const PartnerInboxView = { Offered: 'offered', Active: 'active', Closed: 'closed' } as const;

export const PARTNER_INBOX_VIEWS = [PartnerInboxView.Offered, PartnerInboxView.Active, PartnerInboxView.Closed] as const;

export const PartnerLeadAction = {
  Accept: 'accept',
  Decline: 'decline',
  RevealContact: 'reveal_contact',
  LogActivity: 'log_activity',
  FollowUp: 'follow_up',
  Edit: 'edit',
  OfflineConversion: 'offline_conversion',
  Return: 'return',
  Lost: 'lost',
  SubAssign: 'sub_assign',
} as const;

export const OTHER_REASON = 'other';

export const DECLINE_REASONS = ['outside_service_area', 'category_not_handled', 'capacity_full', 'conflict_of_interest', OTHER_REASON] as const;

export const RETURN_REASONS = ['unreachable', 'not_interested', 'not_eligible', 'wrong_details', 'capacity_full', OTHER_REASON] as const;

export const LEAD_DETAIL_STATUSES: readonly string[] = ['offered', 'accepted', 'working', 'completed'];

export const PARTNER_FOLLOW_UP_ASSIGNEES = ['me', 'all'] as const;

export const MemberStatus = { Active: 'active', Suspended: 'suspended', Revoked: 'revoked', Pending: 'pending' } as const;

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const MAX_OPEN_LEADS_LIMIT = 10_000;

export const ATTRIBUTION_NOTE_MIN_LENGTH = 10;

export const ATTRIBUTION_NOTE_MAX_LENGTH = 1_000;

export const LEAD_CAPTURE_CONSENT_CONTEXT = 'lead_capture';

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;

export const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,30}$/;

export const STATEMENT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
