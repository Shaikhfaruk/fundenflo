export const StatusTone = {
  Neutral: 'neutral',
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
  Strong: 'strong',
} as const;

export type StatusTone = (typeof StatusTone)[keyof typeof StatusTone];

const ApplicationStatus = {
  Draft: 'draft',
  PreScreened: 'pre_screened',
  DocumentsPending: 'documents_pending',
  Assessed: 'assessed',
  ReadyForSubmission: 'ready_for_submission',
  Submitted: 'submitted',
  ClosedWon: 'closed_won',
  ClosedLost: 'closed_lost',
  Withdrawn: 'withdrawn',
  Expired: 'expired',
} as const;

export const CLOSED_APPLICATION_STATUSES: readonly string[] = [ApplicationStatus.ClosedWon, ApplicationStatus.ClosedLost, ApplicationStatus.Withdrawn, ApplicationStatus.Expired];

export const APPLICATION_STATUS_TONE: Record<string, StatusTone> = {
  draft: StatusTone.Neutral,
  pre_screened: StatusTone.Info,
  documents_pending: StatusTone.Danger,
  assessed: StatusTone.Info,
  ready_for_submission: StatusTone.Info,
  submitted: StatusTone.Warning,
  closed_won: StatusTone.Strong,
  closed_lost: StatusTone.Neutral,
  withdrawn: StatusTone.Neutral,
  expired: StatusTone.Neutral,
};

export const SubmissionStatus = {
  PendingApproval: 'pending_approval',
  Approved: 'approved',
  SentToLender: 'sent_to_lender',
  UnderReview: 'under_review',
  QueryRaised: 'query_raised',
  Sanctioned: 'sanctioned',
  Disbursed: 'disbursed',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
} as const;

export const CLOSED_SUBMISSION_STATUSES: readonly string[] = [SubmissionStatus.Rejected, SubmissionStatus.Withdrawn];

export const WITHDRAWABLE_SUBMISSION_STATUSES: readonly string[] = [SubmissionStatus.PendingApproval, SubmissionStatus.Approved, SubmissionStatus.SentToLender, SubmissionStatus.UnderReview, SubmissionStatus.QueryRaised, SubmissionStatus.Sanctioned];

export const SUBMISSION_PROGRESS: readonly string[] = [SubmissionStatus.PendingApproval, SubmissionStatus.Approved, SubmissionStatus.SentToLender, SubmissionStatus.UnderReview, SubmissionStatus.Sanctioned, SubmissionStatus.Disbursed];

export const SUBMISSION_STATUS_TONE: Record<string, StatusTone> = {
  pending_approval: StatusTone.Warning,
  approved: StatusTone.Info,
  sent_to_lender: StatusTone.Info,
  under_review: StatusTone.Warning,
  query_raised: StatusTone.Danger,
  sanctioned: StatusTone.Strong,
  disbursed: StatusTone.Success,
  rejected: StatusTone.Neutral,
  withdrawn: StatusTone.Neutral,
};

export const LEAD_STATUS_TONE: Record<string, StatusTone> = {
  new: StatusTone.Info,
  qualified: StatusTone.Success,
  in_progress: StatusTone.Info,
  on_hold: StatusTone.Warning,
  converted: StatusTone.Strong,
  won: StatusTone.Success,
  lost: StatusTone.Danger,
  unqualified: StatusTone.Neutral,
};

export const LEAD_CONSENT_TONE: Record<string, StatusTone> = {
  pending: StatusTone.Warning,
  ok: StatusTone.Success,
  withdrawn: StatusTone.Danger,
};

export const DATA_REQUEST_STATUS_TONE: Record<string, StatusTone> = {
  received: StatusTone.Info,
  in_progress: StatusTone.Warning,
  completed: StatusTone.Success,
  rejected: StatusTone.Danger,
};

export const SEVERITY_TONE: Record<string, StatusTone> = {
  low: StatusTone.Neutral,
  medium: StatusTone.Warning,
  high: StatusTone.Danger,
  critical: StatusTone.Danger,
};

export const REVIEW_STATUS_TONE: Record<string, StatusTone> = {
  open: StatusTone.Warning,
  decided: StatusTone.Neutral,
  resolved: StatusTone.Success,
  dismissed: StatusTone.Neutral,
  confirmed: StatusTone.Danger,
  cleared: StatusTone.Success,
  linked: StatusTone.Success,
  done: StatusTone.Success,
  cancelled: StatusTone.Neutral,
  reported: StatusTone.Warning,
  verified: StatusTone.Success,
  rejected: StatusTone.Danger,
  granted: StatusTone.Success,
  pending: StatusTone.Warning,
  declined: StatusTone.Danger,
  offered: StatusTone.Info,
  accepted: StatusTone.Info,
  working: StatusTone.Warning,
  completed: StatusTone.Success,
  expired: StatusTone.Neutral,
  revoked: StatusTone.Neutral,
  returned: StatusTone.Neutral,
  fulfilled: StatusTone.Success,
};

export const DOCUMENT_STATUS_TONE: Record<string, StatusTone> = {
  uploaded: StatusTone.Info,
  scanning: StatusTone.Info,
  scanned: StatusTone.Info,
  classifying: StatusTone.Info,
  extracting: StatusTone.Info,
  verified: StatusTone.Success,
  needs_review: StatusTone.Warning,
  rejected: StatusTone.Danger,
  expired: StatusTone.Neutral,
};

export const toneOf = (map: Record<string, StatusTone>, status: string): StatusTone => map[status] ?? StatusTone.Neutral;
