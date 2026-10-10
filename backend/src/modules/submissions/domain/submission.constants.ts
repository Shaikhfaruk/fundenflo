import { Role, SubmissionEventType } from '../../../common/enums/db.enums.js';
import { SubmissionEvent } from '../../../engines/state-machines/machines/submission.machine.js';

export const RejectionReason = {
  PolicyMismatch: 'policy_mismatch',
  InsufficientIncome: 'insufficient_income',
  HighObligations: 'high_obligations',
  CreditHistory: 'credit_history',
  IncompleteDocuments: 'incomplete_documents',
  KycIssue: 'kyc_issue',
  FraudSuspected: 'fraud_suspected',
  BorrowerUnresponsive: 'borrower_unresponsive',
  Other: 'other',
} as const;

export type RejectionReason = (typeof RejectionReason)[keyof typeof RejectionReason];

export const REJECTION_REASON_LABELS: Record<RejectionReason, { en: string }> = {
  [RejectionReason.PolicyMismatch]: { en: 'Outside the lender policy' },
  [RejectionReason.InsufficientIncome]: { en: 'Income or turnover too low' },
  [RejectionReason.HighObligations]: { en: 'Existing obligations too high' },
  [RejectionReason.CreditHistory]: { en: 'Credit history' },
  [RejectionReason.IncompleteDocuments]: { en: 'Documents incomplete' },
  [RejectionReason.KycIssue]: { en: 'KYC could not be completed' },
  [RejectionReason.FraudSuspected]: { en: 'Verification concerns' },
  [RejectionReason.BorrowerUnresponsive]: { en: 'Borrower did not respond' },
  [RejectionReason.Other]: { en: 'Other' },
};

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

export type SubmissionAction = (typeof SubmissionAction)[keyof typeof SubmissionAction];

export const LENDER_SUBMISSION_ACTIONS = [SubmissionAction.Acknowledge, SubmissionAction.RaiseQuery, SubmissionAction.Sanction, SubmissionAction.Disburse, SubmissionAction.Reject, SubmissionAction.Note] as const;

export const OPS_SUBMISSION_ACTIONS = [
  SubmissionAction.Acknowledge,
  SubmissionAction.RaiseQuery,
  SubmissionAction.AnswerQuery,
  SubmissionAction.Sanction,
  SubmissionAction.Disburse,
  SubmissionAction.Reject,
  SubmissionAction.Withdraw,
  SubmissionAction.Note,
] as const;

export const SUBMISSION_ACTION_EVENTS: Record<Exclude<SubmissionAction, typeof SubmissionAction.Note>, SubmissionEvent> = {
  [SubmissionAction.Acknowledge]: SubmissionEvent.Acknowledge,
  [SubmissionAction.RaiseQuery]: SubmissionEvent.RaiseQuery,
  [SubmissionAction.AnswerQuery]: SubmissionEvent.AnswerQuery,
  [SubmissionAction.Sanction]: SubmissionEvent.Sanction,
  [SubmissionAction.Disburse]: SubmissionEvent.Disburse,
  [SubmissionAction.Reject]: SubmissionEvent.Reject,
  [SubmissionAction.Withdraw]: SubmissionEvent.Withdraw,
};

export const SUBMISSION_EVENT_TYPES: Record<SubmissionEvent, SubmissionEventType> = {
  [SubmissionEvent.Approve]: SubmissionEventType.approved,
  [SubmissionEvent.Send]: SubmissionEventType.sent,
  [SubmissionEvent.Acknowledge]: SubmissionEventType.acknowledged,
  [SubmissionEvent.RaiseQuery]: SubmissionEventType.query_raised,
  [SubmissionEvent.AnswerQuery]: SubmissionEventType.query_answered,
  [SubmissionEvent.Sanction]: SubmissionEventType.sanctioned,
  [SubmissionEvent.Disburse]: SubmissionEventType.disbursed,
  [SubmissionEvent.Reject]: SubmissionEventType.rejected,
  [SubmissionEvent.Withdraw]: SubmissionEventType.withdrawn,
};

export const EVIDENCE_REQUIRED_EVENTS: readonly SubmissionEvent[] = [SubmissionEvent.Sanction, SubmissionEvent.Disburse];

export const SubmissionCloseReason = {
  ConsentWithdrawn: 'consent_withdrawn',
  AllLendersDeclined: 'all_lenders_declined',
  Disbursed: 'disbursed',
  RequestsFulfilled: 'requests_fulfilled',
} as const;

export const SUBMISSION_NOTIFY_ROLES: readonly Role[] = [Role.lender_admin, Role.lender_credit_officer];

export const SUBMISSIONS_OPEN_MAX = 5;

export const SUBMISSIONS_PER_APPLICATION_LIMIT = 50;

export const SUBMISSION_EVENTS_LIMIT = 100;

export const SUBMISSION_NOTE_MAX_LENGTH = 1_000;

export const LENDER_REFERENCE_MAX_LENGTH = 100;

export const DOCUMENT_REQUEST_TYPES_MAX = 10;

export const DOCUMENT_REQUEST_DUE_DAYS_MAX = 30;

export const DOCUMENT_REQUEST_FULFIL_BATCH = 50;

export const DOCUMENT_REQUESTS_LIMIT = 50;

export const PACKET_FORMAT_VERSION = 1;

export const PACKET_FACTS_MAX = 200;
