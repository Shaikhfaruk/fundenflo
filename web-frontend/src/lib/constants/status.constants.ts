import { StatusTone } from '@/components/data/status-badge';

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

export const APPLICATION_STATUS_TONE: Record<string, StatusTone> = {
  draft: StatusTone.Neutral,
  pre_screened: StatusTone.Info,
  documents_pending: StatusTone.Warning,
  assessed: StatusTone.Info,
  ready_for_submission: StatusTone.Info,
  submitted: StatusTone.Info,
  closed_won: StatusTone.Success,
  closed_lost: StatusTone.Danger,
  withdrawn: StatusTone.Neutral,
  expired: StatusTone.Neutral,
};

export const SUBMISSION_STATUS_TONE: Record<string, StatusTone> = {
  pending_approval: StatusTone.Warning,
  approved: StatusTone.Info,
  sent_to_lender: StatusTone.Info,
  under_review: StatusTone.Info,
  query_raised: StatusTone.Warning,
  sanctioned: StatusTone.Success,
  disbursed: StatusTone.Success,
  rejected: StatusTone.Danger,
  withdrawn: StatusTone.Neutral,
};

export const LEAD_STATUS_TONE: Record<string, StatusTone> = {
  new: StatusTone.Info,
  qualified: StatusTone.Success,
  in_progress: StatusTone.Info,
  on_hold: StatusTone.Warning,
  converted: StatusTone.Success,
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

export const toneOf = (map: Record<string, StatusTone>, status: string): StatusTone => map[status] ?? StatusTone.Neutral;
