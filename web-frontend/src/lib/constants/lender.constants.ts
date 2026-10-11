export const LenderStatus = { Onboarding: 'onboarding', Active: 'active', Paused: 'paused', Offboarded: 'offboarded' } as const;

export const LENDER_INBOX_FILTERS = ['sent_to_lender', 'under_review', 'query_raised', 'sanctioned', 'disbursed', 'rejected'] as const;

export const LenderAction = {
  Acknowledge: 'acknowledge',
  RaiseQuery: 'raise_query',
  Sanction: 'sanction',
  Disburse: 'disburse',
  Reject: 'reject',
  Note: 'note',
} as const;

export type LenderAction = (typeof LenderAction)[keyof typeof LenderAction];

export const LENDER_ACTIONS_BY_STATUS: Record<string, LenderAction[]> = {
  sent_to_lender: [LenderAction.Acknowledge, LenderAction.RaiseQuery, LenderAction.Reject, LenderAction.Note],
  under_review: [LenderAction.Sanction, LenderAction.RaiseQuery, LenderAction.Reject, LenderAction.Note],
  query_raised: [LenderAction.Reject, LenderAction.Note],
  sanctioned: [LenderAction.Disburse, LenderAction.Note],
  disbursed: [LenderAction.Disburse, LenderAction.Note],
};

export const LENDER_PRIMARY_ACTIONS: readonly string[] = [LenderAction.Acknowledge, LenderAction.Sanction, LenderAction.Disburse];

export const DOCUMENT_REQUEST_STATUSES: readonly string[] = ['sent_to_lender', 'under_review', 'query_raised', 'sanctioned'];

export const LENDER_VIEWER_ROLE = 'lender_viewer';

export const CHECKLIST_STAGES = ['assessment', 'submission'] as const;

export const PRODUCT_REASON_MIN_LENGTH = 2;

export const PRODUCT_REASON_MAX_LENGTH = 1_000;
