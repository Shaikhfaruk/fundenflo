export const AuditAction = {
  OtpLogin: 'auth.otp_login',
  StaffLogin: 'auth.staff_login',
  StaffLoginFailed: 'auth.staff_login_failed',
  MfaEnabled: 'auth.mfa_enabled',
  Logout: 'auth.logout',
  RefreshReused: 'auth.refresh_reused',
  ContextSwitched: 'auth.context_switched',
  SessionRevoked: 'session.revoked',
  ProfileUpdated: 'profile.updated',
  LoginLinked: 'login.linked',
  LoginRemoved: 'login.removed',
  MobileChanged: 'mobile.changed',
  UserStatusChanged: 'user.status_changed',
  MembershipCreated: 'membership.created',
  MembershipChanged: 'membership.changed',
  InvitationCreated: 'invitation.created',
  InvitationAccepted: 'invitation.accepted',
  InvitationRevoked: 'invitation.revoked',
  PartyMatchReviewOpened: 'party.match_review_opened',
  CatalogCreated: 'catalog.created',
  CatalogChanged: 'catalog.changed',
  CatalogDeleted: 'catalog.deleted',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  User: 'user',
  Session: 'session',
  Membership: 'membership',
  Invitation: 'invitation',
  Party: 'party',
  UserLogin: 'user_login',
  StaffCredential: 'staff_credential',
  Segment: 'segment',
  SubSegment: 'sub_segment',
  LoanCategory: 'loan_category',
  CategoryPurpose: 'category_purpose',
  GeoCity: 'geo_city',
  GeoPincode: 'geo_pincode',
  LookupAlias: 'lookup_alias',
} as const;

export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];

export const AUDIT_VERIFY_MAX_ROWS = 5_000;
