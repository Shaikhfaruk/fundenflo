import { ContactType } from '../../../common/enums/db.enums.js';
import { BlindIndexDomain } from '../../../infrastructure/crypto/crypto.constants.js';

export const ContactSource = {
  OtpLogin: 'otp_login',
  LoginLink: 'login_link',
  MobileChange: 'mobile_change',
  StaffInvitation: 'staff_invitation',
  Seed: 'seed',
} as const;

export type ContactSource = (typeof ContactSource)[keyof typeof ContactSource];

export const CONTACT_INDEX_DOMAIN: Record<ContactType, (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain]> = {
  [ContactType.mobile]: BlindIndexDomain.Mobile,
  [ContactType.email]: BlindIndexDomain.Email,
  [ContactType.landline]: BlindIndexDomain.Landline,
};

export const MatchSignal = {
  SharedVerifiedContact: 'shared_verified_contact',
  SharedContact: 'shared_contact',
} as const;
