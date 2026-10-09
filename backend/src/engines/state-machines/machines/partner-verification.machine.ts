import { defineMachine } from '../define-machine.js';

export const PartnerVerificationState = {
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;

export type PartnerVerificationState = (typeof PartnerVerificationState)[keyof typeof PartnerVerificationState];

export const PartnerVerificationEvent = {
  Recommend: 'recommend',
  Approve: 'approve',
  Reject: 'reject',
} as const;

export type PartnerVerificationEvent = (typeof PartnerVerificationEvent)[keyof typeof PartnerVerificationEvent];

const { Pending, InReview, Verified, Rejected } = PartnerVerificationState;

export const partnerVerificationMachine = defineMachine<PartnerVerificationState, PartnerVerificationEvent>({
  name: 'partner_verification',
  states: Object.values(PartnerVerificationState),
  transitions: {
    recommend: { from: [Pending], to: InReview },
    approve: { from: [InReview], to: Verified },
    reject: { from: [InReview], to: Rejected },
  },
});
