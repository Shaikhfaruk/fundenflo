import type { Role, SessionContext } from '../../../common/enums/db.enums.js';
import type { MembershipView, OrganizationSummaryView } from '../../access/application/access.views.js';
import type { NextActionCode } from './auth.enums.js';

export type AccessClaims = {
  userId: string;
  sessionId: string;
  membershipId: string | null;
  context: SessionContext;
  role: Role | null;
  organizationId: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

export type ActiveContextView = {
  membershipId: string;
  context: string;
  role: string;
  organization: OrganizationSummaryView | null;
};

export type LoginView = {
  id: string;
  method: string;
  identifier: string;
  verifiedAt: string;
  lastUsedAt: string | null;
};

export type MeView = {
  id: string;
  status: string;
  fullName: string | null;
  preferredLanguage: string | null;
  mobile: string | null;
  email: string | null;
  profileComplete: boolean;
  version: number;
  activeContext: ActiveContextView | null;
  memberships: MembershipView[];
  logins: LoginView[];
};

export type NextAction = {
  code: NextActionCode;
  message: string;
};

export type AuthResult = TokenPair & {
  user: MeView;
  nextAction: NextAction | null;
};

export type OtpIssued = {
  challengeId: string;
  resendIn: number;
  expiresIn: number;
};

export type SessionView = {
  id: string;
  context: string;
  loginMethod: string;
  deviceName: string | null;
  platform: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};
