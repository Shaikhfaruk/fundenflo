import type { IconName } from '@/components/ui/icon';

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

export type NavItem = { key: string; href: string; icon: IconName; roles?: readonly string[]; primary?: boolean };

export type NavGroup = { key: string; items: NavItem[] };

const LEAD_DESK: readonly string[] = [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.ComplianceOfficer, Role.Support];

const CASE_DESK: readonly string[] = [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst, Role.ComplianceOfficer, Role.Support];

const ALL_STAFF: readonly string[] = [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst, Role.Finance, Role.ComplianceOfficer, Role.Support, Role.LenderManager, Role.PartnerManager];

export const NAVIGATION: Record<NavArea, NavGroup[]> = {
  none: [
    {
      key: 'main',
      items: [
        { key: 'switchRole', href: AppPath.AccountSwitch, icon: 'swap', primary: true },
        { key: 'account', href: AppPath.Account, icon: 'account', primary: true },
      ],
    },
  ],
  [ShellArea.Borrower]: [
    {
      key: 'main',
      items: [
        { key: 'home', href: AppPath.BorrowerHome, icon: 'tab-home', primary: true },
        { key: 'newApplication', href: AppPath.BorrowerNewApplication, icon: 'add', primary: true },
        { key: 'profile', href: AppPath.BorrowerProfile, icon: 'account', primary: true },
      ],
    },
  ],
  [ShellArea.Partner]: [
    {
      key: 'main',
      items: [
        { key: 'dashboard', href: AppPath.PartnerHome, icon: 'dashboard', primary: true },
        { key: 'account', href: AppPath.Account, icon: 'account', primary: true },
      ],
    },
  ],
  [ShellArea.Lender]: [
    {
      key: 'main',
      items: [
        { key: 'submissions', href: AppPath.LenderHome, icon: 'inbox', primary: true },
        { key: 'products', href: AppPath.LenderProducts, icon: 'assignment', primary: true },
        { key: 'account', href: AppPath.Account, icon: 'account', primary: true },
      ],
    },
  ],
  [ShellArea.Staff]: [
    {
      key: 'ops',
      items: [
        { key: 'leads', href: AppPath.OpsHome, icon: 'group', roles: LEAD_DESK, primary: true },
        { key: 'followUps', href: AppPath.OpsFollowUps, icon: 'alarm', roles: LEAD_DESK },
        { key: 'conversions', href: AppPath.OpsConversions, icon: 'payments', roles: LEAD_DESK },
        { key: 'disputes', href: AppPath.OpsDisputes, icon: 'gavel', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.ComplianceOfficer] },
        { key: 'reports', href: AppPath.OpsReports, icon: 'monitoring', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer] },
      ],
    },
    {
      key: 'cases',
      items: [
        { key: 'cases', href: AppPath.OpsCases, icon: 'folder', roles: CASE_DESK, primary: true },
        { key: 'submissions', href: AppPath.OpsSubmissions, icon: 'inbox', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.ComplianceOfficer, Role.Support], primary: true },
        { key: 'signals', href: AppPath.OpsSignals, icon: 'sync-alt', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst] },
        { key: 'risk', href: AppPath.OpsRisk, icon: 'flag', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst, Role.ComplianceOfficer] },
      ],
    },
    {
      key: 'parties',
      items: [
        { key: 'duplicates', href: AppPath.OpsMatchReviews, icon: 'swap', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer] },
        { key: 'merges', href: AppPath.OpsMerges, icon: 'history', roles: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer] },
        { key: 'dataRequests', href: AppPath.OpsDataRequests, icon: 'privacy', roles: [Role.SuperAdmin, Role.OpsLead, Role.ComplianceOfficer, Role.Support] },
      ],
    },
    {
      key: 'you',
      items: [{ key: 'account', href: AppPath.Account, icon: 'account', roles: ALL_STAFF, primary: true }],
    },
  ],
};

export const MAX_PRIMARY_TABS = 4;

export const PORTAL_AREAS: readonly NavArea[] = [ShellArea.Partner, ShellArea.Lender, ShellArea.Staff];
