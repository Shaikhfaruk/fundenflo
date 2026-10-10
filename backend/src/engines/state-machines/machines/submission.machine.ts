import { defineMachine } from '../define-machine.js';

export const SubmissionState = {
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

export type SubmissionState = (typeof SubmissionState)[keyof typeof SubmissionState];

export const SubmissionEvent = {
  Approve: 'approve',
  Send: 'send',
  Acknowledge: 'acknowledge',
  RaiseQuery: 'raise_query',
  AnswerQuery: 'answer_query',
  Sanction: 'sanction',
  Disburse: 'disburse',
  Reject: 'reject',
  Withdraw: 'withdraw',
} as const;

export type SubmissionEvent = (typeof SubmissionEvent)[keyof typeof SubmissionEvent];

const { PendingApproval, Approved, SentToLender, UnderReview, QueryRaised, Sanctioned, Disbursed, Rejected, Withdrawn } = SubmissionState;

export const submissionMachine = defineMachine<SubmissionState, SubmissionEvent>({
  name: 'lender_submission',
  states: Object.values(SubmissionState),
  transitions: {
    approve: { from: [PendingApproval], to: Approved },
    send: { from: [Approved], to: SentToLender },
    acknowledge: { from: [SentToLender], to: UnderReview },
    raise_query: { from: [SentToLender, UnderReview], to: QueryRaised },
    answer_query: { from: [QueryRaised], to: UnderReview },
    sanction: { from: [UnderReview], to: Sanctioned },
    disburse: { from: [Sanctioned, Disbursed], to: Disbursed },
    reject: { from: [SentToLender, UnderReview, QueryRaised], to: Rejected },
    withdraw: { from: [PendingApproval, Approved, SentToLender, UnderReview, QueryRaised, Sanctioned], to: Withdrawn },
  },
});

export const LENDER_DECISION_EVENTS: readonly SubmissionEvent[] = [SubmissionEvent.Sanction, SubmissionEvent.Disburse, SubmissionEvent.Reject];

export const OPEN_SUBMISSION_STATES: readonly SubmissionState[] = [PendingApproval, Approved, SentToLender, UnderReview, QueryRaised, Sanctioned];

export const SENT_SUBMISSION_STATES: readonly SubmissionState[] = [SentToLender, UnderReview, QueryRaised, Sanctioned, Disbursed, Rejected];
