import { LoginAs, SessionContext } from './auth.constants';

export const AppPath = {
  Landing: '/',
  Login: '/login',
  StaffLogin: '/staff/login',
  StaffInvite: '/staff/invite',
  Offline: '/offline',
  Account: '/account',
  AccountSecurity: '/account/security',
  AccountConsents: '/account/consents',
  AccountNotifications: '/account/notifications',
  AccountPrivacy: '/account/privacy',
  AccountSwitch: '/account/switch',
  BorrowerHome: '/app',
  BorrowerNewApplication: '/app/applications/new',
  BorrowerProfile: '/app/profile',
  PartnerHome: '/partner',
  PartnerSignup: '/partner/signup',
  LenderHome: '/lender',
  OpsHome: '/ops/leads',
  AdminHome: '/admin/users',
  FinanceHome: '/finance/receivables',
} as const;

export const HOME_BY_CONTEXT: Record<string, string> = {
  [SessionContext.None]: AppPath.AccountSwitch,
  [SessionContext.Borrower]: AppPath.BorrowerHome,
  [SessionContext.Partner]: AppPath.PartnerHome,
  [SessionContext.Lender]: AppPath.LenderHome,
  [SessionContext.Staff]: AppPath.OpsHome,
};

export const ProtectedArea = {
  Borrower: '/app',
  Partner: '/partner',
  Lender: '/lender',
  Ops: '/ops',
  Admin: '/admin',
  Finance: '/finance',
  Account: '/account',
} as const;

export const STAFF_SIGN_IN_AREAS: readonly string[] = [ProtectedArea.Ops, ProtectedArea.Admin, ProtectedArea.Finance];

export const AREA_LOGIN_AS: Record<string, string> = { [ProtectedArea.Lender]: LoginAs.Lender };

export const LOGIN_AS_PARAM = 'as';

export const NEXT_PARAM = 'next';

export const RoutePath = {
  application: (id: string) => `${AppPath.BorrowerHome}/applications/${id}`,
  applicationStep: (id: string, step: string) => `${AppPath.BorrowerHome}/applications/${id}/${step}`,
};
