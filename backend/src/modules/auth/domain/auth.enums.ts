export const NextActionCode = {
  PartnerNotOnboarded: 'PARTNER_NOT_ONBOARDED',
  MembershipRequired: 'MEMBERSHIP_REQUIRED',
} as const;

export type NextActionCode = (typeof NextActionCode)[keyof typeof NextActionCode];

export const RevokeReason = {
  Logout: 'logout',
  LogoutOthers: 'logout_others',
  RevokedByUser: 'revoked_by_user',
  RefreshReuse: 'refresh_reuse',
  MembershipChanged: 'membership_changed',
  UserSuspended: 'user_suspended',
  MobileChanged: 'mobile_changed',
  Expired: 'expired',
} as const;

export type RevokeReason = (typeof RevokeReason)[keyof typeof RevokeReason];
