import { Role, SessionContext } from './auth.constants';
import { AppPath } from './routes.constants';

export const ShellArea = {
  Borrower: 'borrower',
  Partner: 'partner',
  Lender: 'lender',
  Staff: 'staff',
  Account: 'account',
} as const;

export type ShellArea = (typeof ShellArea)[keyof typeof ShellArea];

export const AREA_CONTEXT: Record<Exclude<ShellArea, 'account'>, string> = {
  [ShellArea.Borrower]: SessionContext.Borrower,
  [ShellArea.Partner]: SessionContext.Partner,
  [ShellArea.Lender]: SessionContext.Lender,
  [ShellArea.Staff]: SessionContext.Staff,
};

export type NavArea = Exclude<ShellArea, 'account'> | 'none';

export const CONTEXT_AREA: Record<string, NavArea> = {
  [SessionContext.None]: 'none',
  [SessionContext.Borrower]: ShellArea.Borrower,
  [SessionContext.Partner]: ShellArea.Partner,
  [SessionContext.Lender]: ShellArea.Lender,
  [SessionContext.Staff]: ShellArea.Staff,
};

export const NavIcon = {
  Home: 'home',
  NewApplication: 'newApplication',
  Profile: 'profile',
  Dashboard: 'dashboard',
  Leads: 'leads',
  Submissions: 'submissions',
  SwitchRole: 'switchRole',
  Account: 'account',
} as const;

export type NavIcon = (typeof NavIcon)[keyof typeof NavIcon];

export type NavItem = { key: string; href: string; icon: NavIcon; roles?: readonly string[]; primary?: boolean };

export type NavGroup = { key: string; items: NavItem[] };

const ALL_STAFF: readonly string[] = [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst, Role.Finance, Role.ComplianceOfficer, Role.Support, Role.LenderManager, Role.PartnerManager];

export const NAVIGATION: Record<NavArea, NavGroup[]> = {
  none: [
    {
      key: 'main',
      items: [
        { key: 'switchRole', href: AppPath.AccountSwitch, icon: NavIcon.SwitchRole, primary: true },
        { key: 'account', href: AppPath.Account, icon: NavIcon.Account, primary: true },
      ],
    },
  ],
  [ShellArea.Borrower]: [
    {
      key: 'main',
      items: [
        { key: 'home', href: AppPath.BorrowerHome, icon: NavIcon.Home, primary: true },
        { key: 'newApplication', href: AppPath.BorrowerNewApplication, icon: NavIcon.NewApplication, primary: true },
        { key: 'account', href: AppPath.Account, icon: NavIcon.Account, primary: true },
      ],
    },
  ],
  [ShellArea.Partner]: [
    {
      key: 'main',
      items: [
        { key: 'dashboard', href: AppPath.PartnerHome, icon: NavIcon.Dashboard, primary: true },
        { key: 'account', href: AppPath.Account, icon: NavIcon.Account, primary: true },
      ],
    },
  ],
  [ShellArea.Lender]: [
    {
      key: 'main',
      items: [
        { key: 'submissions', href: AppPath.LenderHome, icon: NavIcon.Submissions, primary: true },
        { key: 'account', href: AppPath.Account, icon: NavIcon.Account, primary: true },
      ],
    },
  ],
  [ShellArea.Staff]: [
    {
      key: 'ops',
      items: [{ key: 'leads', href: AppPath.OpsHome, icon: NavIcon.Leads, roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.ComplianceOfficer, Role.Support], primary: true }],
    },
    {
      key: 'you',
      items: [{ key: 'account', href: AppPath.Account, icon: NavIcon.Account, roles: ALL_STAFF, primary: true }],
    },
  ],
};

export const MAX_PRIMARY_TABS = 4;
