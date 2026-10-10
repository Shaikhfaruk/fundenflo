export const SessionContext = {
  None: 'none',
  Borrower: 'borrower',
  Partner: 'partner',
  Lender: 'lender',
  Staff: 'staff',
} as const;

export type SessionContext = (typeof SessionContext)[keyof typeof SessionContext];

export const LoginAs = {
  Borrower: 'borrower',
  Ca: 'ca',
  Dsa: 'dsa',
  Lender: 'lender',
} as const;

export type LoginAs = (typeof LoginAs)[keyof typeof LoginAs];

export const Role = {
  Borrower: 'borrower',
  BusinessOwner: 'business_owner',
  AuthorisedSignatory: 'authorised_signatory',
  BusinessMember: 'business_member',
  PartnerOwner: 'partner_owner',
  PartnerAgent: 'partner_agent',
  LenderAdmin: 'lender_admin',
  LenderCreditOfficer: 'lender_credit_officer',
  LenderViewer: 'lender_viewer',
  SuperAdmin: 'super_admin',
  OpsLead: 'ops_lead',
  OpsReviewer: 'ops_reviewer',
  CreditAnalyst: 'credit_analyst',
  LenderManager: 'lender_manager',
  PartnerManager: 'partner_manager',
  Finance: 'finance',
  ComplianceOfficer: 'compliance_officer',
  Support: 'support',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const NextActionCode = {
  PartnerNotOnboarded: 'PARTNER_NOT_ONBOARDED',
  MembershipRequired: 'MEMBERSHIP_REQUIRED',
  PartnerPendingVerification: 'PARTNER_PENDING_VERIFICATION',
  MembershipSuspended: 'MEMBERSHIP_SUSPENDED',
} as const;

export type NextActionCode = (typeof NextActionCode)[keyof typeof NextActionCode];

export const OTP_LENGTH = 6;

export const DEFAULT_COUNTRY_CODE = '+91';

export const STAFF_PASSWORD_MIN_LENGTH = 12;

export const STAFF_PASSWORD_MAX_LENGTH = 128;

export const StaffAuthError = {
  CredentialsInvalid: 'CREDENTIALS_INVALID',
  MfaCodeInvalid: 'MFA_CODE_INVALID',
  MfaTokenInvalid: 'MFA_TOKEN_INVALID',
} as const;

export const DevicePlatform = {
  Web: 'web',
} as const;

export const MembershipStatus = {
  Pending: 'pending',
  Active: 'active',
  Suspended: 'suspended',
  Revoked: 'revoked',
} as const;

export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const MOBILE_DIGITS = 10;

export const MOBILE_GROUP_SPLIT = 5;

export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,24}$/;

export const REFERRAL_CODE_MAX_LENGTH = 24;
