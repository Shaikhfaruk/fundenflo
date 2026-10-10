export const CASE_STATUSES = ['draft', 'pre_screened', 'documents_pending', 'assessed', 'ready_for_submission', 'submitted', 'closed_won', 'closed_lost', 'withdrawn', 'expired'] as const;

export const APPLICATION_CHANNELS = ['direct', 'partner', 'ops'] as const;

export const SUBMISSION_STATUSES = ['pending_approval', 'approved', 'sent_to_lender', 'under_review', 'query_raised', 'sanctioned', 'disbursed', 'rejected', 'withdrawn'] as const;

export const SubmissionAction = {
  Acknowledge: 'acknowledge',
  RaiseQuery: 'raise_query',
  AnswerQuery: 'answer_query',
  Sanction: 'sanction',
  Disburse: 'disburse',
  Reject: 'reject',
  Withdraw: 'withdraw',
  Note: 'note',
} as const;

export const SUBMISSION_REJECTION_REASONS = ['policy_mismatch', 'insufficient_income', 'high_obligations', 'credit_history', 'incomplete_documents', 'kyc_issue', 'fraud_suspected', 'borrower_unresponsive', 'other'] as const;

export const SUBMISSION_NOTE_MIN_LENGTH = 3;

export const SUBMISSION_NOTE_MAX_LENGTH = 1_000;

export const RecomputeMode = { Reproduce: 'reproduce', Current: 'current' } as const;

export const DOCUMENT_REJECT_REASONS = ['infected', 'wrong_document', 'illegible', 'outdated', 'other'] as const;

export const ReviewOutcome = { Verified: 'verified', Rejected: 'rejected' } as const;

export const DOCUMENT_REQUEST_DUE_DAYS = 7;

export const CONSISTENCY_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export const ConsistencyResolution = { Resolved: 'resolved', Dismissed: 'dismissed' } as const;

export const RISK_SIGNAL_KINDS = ['duplicate_identity', 'identity_mismatch', 'inflow_mismatch', 'gst_itr_mismatch', 'doc_tamper', 'document_reuse', 'referral_pattern'] as const;

export const RISK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export const RISK_SIGNAL_STATUSES = ['open', 'confirmed', 'dismissed'] as const;

export const FRAUD_REVIEW_STATUSES = ['open', 'decided'] as const;

export const FRAUD_DECISIONS = ['cleared', 'confirmed'] as const;

export const FRAUD_NOTE_MIN_LENGTH = 10;

export const DATA_REQUEST_STATUSES = ['received', 'in_progress', 'completed', 'rejected'] as const;

export const DATA_REQUEST_KINDS = ['access', 'correction', 'erasure'] as const;

export const DISPUTE_STATUSES = ['open', 'resolved'] as const;

export const DISPUTE_OUTCOMES = ['keep_holder', 'transfer', 'void'] as const;

export const MATCH_REVIEW_STATUSES = ['open', 'linked', 'dismissed'] as const;

export const MatchReviewDecision = { Merge: 'merge', Dismiss: 'dismiss' } as const;

export const PARTY_REASON_MIN_LENGTH = 5;

export const FOLLOW_UP_STATUSES = ['open', 'done', 'cancelled'] as const;

export const FollowUpStatus = { Open: 'open', Done: 'done', Cancelled: 'cancelled' } as const;

export const FOLLOW_UP_ASSIGNEES = ['me', 'all'] as const;

export const CONVERSION_STATUSES = ['reported', 'verified', 'rejected'] as const;

export const ConversionDecision = { Verify: 'verify', Reject: 'reject' } as const;

export const LEAD_UNQUALIFIED_REASONS = ['junk', 'invalid_number', 'duplicate', 'not_interested', 'not_eligible', 'do_not_contact', 'test'] as const;

export const LEAD_LOST_REASONS = ['not_interested', 'not_eligible', 'went_elsewhere', 'unreachable', 'other'] as const;

export const ACTIVITY_TYPES = ['call', 'meeting', 'whatsapp', 'email', 'sms', 'note'] as const;

export const ACTIVITY_OUTCOMES = ['connected', 'no_answer', 'busy', 'wrong_number', 'call_back', 'switched_off'] as const;

export const ActivityType = { Call: 'call', Note: 'note' } as const;

export const LEAD_URGENCIES = ['immediate', 'within_month', 'exploring'] as const;

export const LEAD_NOTE_MIN_LENGTH = 3;

export const LEAD_NOTE_MAX_LENGTH = 1_000;

export const FUNNEL_GROUPS = ['source', 'campaign', 'city', 'category', 'segment'] as const;

export const REPORT_DAYS = 30;

export const OPS_CONSENT_CHANNELS = ['ops_call', 'web_form', 'sms_link', 'whatsapp_link', 'partner_assisted', 'import'] as const;

export const OPS_CONSENT_EVIDENCE_MIN_LENGTH = 5;

export const ANSWER_STAGE = 'pre_check';

export const DATA_REQUEST_TEXT_MAX_LENGTH = 2_000;

export const ACTIVITY_BODY_MAX_LENGTH = 2_000;

export const FOLLOW_UP_MAX_DAYS_AHEAD = 180;
