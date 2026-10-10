type OrganizationSummary = { id: string; name: string; type: string; status: string };

export type MembershipView = { id: string; context: string; role: string; status: string; organization: OrganizationSummary | null; version: number; createdAt: string };

type ActiveContextView = { membershipId: string; context: string; role: string; organization: OrganizationSummary | null };

export type LoginView = { id: string; method: string; identifier: string; verifiedAt: string; lastUsedAt: string | null };

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

export type NextAction = { code: string; message: string };

export type SessionPayload = { user: MeView; nextAction: NextAction | null; expiresAt: number };

export type OtpIssued = { challengeId: string; resendIn: number; expiresIn: number };

export type StaffLoginResult = { mfaToken: string; mfaRequired: true; mfaSetup: { secret: string; otpauthUrl: string } | null };

export type SessionView = { id: string; context: string; loginMethod: string; deviceName: string | null; platform: string | null; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean };
