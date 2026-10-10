import { ContactType, IdentifierType } from '../../../common/enums/db.enums.js';
import { BlindIndexDomain } from '../../../infrastructure/crypto/crypto.constants.js';

export const ContactSource = {
  OtpLogin: 'otp_login',
  LoginLink: 'login_link',
  MobileChange: 'mobile_change',
  StaffInvitation: 'staff_invitation',
  Seed: 'seed',
  Lead: 'lead',
  ApplicationParty: 'application_party',
  PartnerFiled: 'partner_filed',
} as const;

export type ContactSource = (typeof ContactSource)[keyof typeof ContactSource];

export const CONTACT_INDEX_DOMAIN: Record<ContactType, (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain]> = {
  [ContactType.mobile]: BlindIndexDomain.Mobile,
  [ContactType.email]: BlindIndexDomain.Email,
  [ContactType.landline]: BlindIndexDomain.Landline,
};

export const IDENTIFIER_INDEX_DOMAIN: Record<IdentifierType, (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain]> = {
  [IdentifierType.pan]: BlindIndexDomain.Pan,
  [IdentifierType.gstin]: BlindIndexDomain.Gstin,
  [IdentifierType.cin]: BlindIndexDomain.Cin,
  [IdentifierType.udyam]: BlindIndexDomain.Udyam,
  [IdentifierType.din]: BlindIndexDomain.Din,
};

export const MatchSignal = {
  SharedVerifiedContact: 'shared_verified_contact',
  SharedContact: 'shared_contact',
} as const;

export const PARTY_MERGE_PARTICIPANT_METADATA = 'parties:merge-participant';

export const PartyMergeParticipantKey = {
  Core: 'parties',
  Users: 'users',
  Organizations: 'organizations',
  Facts: 'facts',
  Answers: 'answers',
  Consents: 'consents',
  Leads: 'leads',
  Borrowers: 'borrowers',
  Applications: 'applications',
  Documents: 'documents',
} as const;

export type PartyMergeParticipantKey = (typeof PartyMergeParticipantKey)[keyof typeof PartyMergeParticipantKey];

export const MatchReviewDecision = {
  Merge: 'merge',
  Dismiss: 'dismiss',
} as const;

export type MatchReviewDecision = (typeof MatchReviewDecision)[keyof typeof MatchReviewDecision];
