import { LoginAs, SessionContext } from './auth.constants';
import { JourneyMode, screenForStage } from './journey.constants';

export const AppPath = {
  Landing: '/',
  Login: '/login',
  StaffLogin: '/staff/login',
  StaffInvite: '/staff/invite',
  Offline: '/offline',
  ConsentLink: '/consent',
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
  PartnerLeads: '/partner/leads',
  PartnerNewLead: '/partner/leads/new',
  PartnerFollowUps: '/partner/follow-ups',
  PartnerClients: '/partner/applications',
  PartnerNewClient: '/partner/applications/new',
  PartnerReferrals: '/partner/referrals',
  PartnerNewDispute: '/partner/disputes/new',
  PartnerCommissions: '/partner/commissions',
  PartnerTeam: '/partner/team',
  PartnerProfile: '/partner/profile',
  PartnerSettings: '/partner/settings',
  LenderHome: '/lender',
  LenderProducts: '/lender/products',
  OpsHome: '/ops/leads',
  OpsCases: '/ops/cases',
  OpsSubmissions: '/ops/submissions',
  OpsFollowUps: '/ops/follow-ups',
  OpsConversions: '/ops/conversions',
  OpsReports: '/ops/reports',
  OpsSignals: '/ops/signals',
  OpsRisk: '/ops/risk',
  OpsMatchReviews: '/ops/parties/match-reviews',
  OpsMerges: '/ops/parties/merges',
  OpsDisputes: '/ops/disputes',
  OpsDataRequests: '/ops/data-requests',
  AdminHome: '/admin/users',
  AdminInvitations: '/admin/invitations',
  AdminAudit: '/admin/audit',
  AdminChangeRequests: '/admin/change-requests',
  AdminSegments: '/admin/catalog/segments',
  AdminCategories: '/admin/catalog/categories',
  AdminCities: '/admin/catalog/cities',
  AdminPincodes: '/admin/catalog/pincodes',
  AdminAliases: '/admin/catalog/aliases',
  AdminAttributes: '/admin/attributes',
  AdminConditions: '/admin/attributes/playground',
  AdminQuestions: '/admin/questions',
  AdminConsentPurposes: '/admin/consents/purposes',
  AdminNotificationTemplates: '/admin/notification-templates',
  AdminImports: '/admin/imports',
  AdminLeadSources: '/admin/lead-sources',
  AdminApiClients: '/admin/lead-sources/api-clients',
  AdminConsentTemplates: '/admin/consents/templates',
  AdminDocumentRequirements: '/admin/documents/requirements',
  AdminQuestionSets: '/admin/question-sets',
  AdminRoutingRules: '/admin/routing-rules',
  AdminLenderProducts: '/admin/lender-products',
  AdminScoringModels: '/admin/scoring-models',
  AdminImprovementRules: '/admin/improvement-rules',
  AdminCommissionSchemes: '/admin/commission-schemes',
  AdminPartners: '/admin/partners',
  AdminLenders: '/admin/lenders',
  AdminDocumentTypes: '/admin/documents/types',
  FinanceHome: '/finance/receivables',
  FinancePayouts: '/finance/payouts',
  FinanceReconciliation: '/finance/reconciliation',
  FinanceLedger: '/finance/ledger',
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

const journeyPaths = (base: string, home: string, start: string) => ({
  home,
  start,
  application: (id: string) => `${base}/applications/${id}`,
  step: (id: string, step: string) => `${base}/applications/${id}/${step}`,
  submission: (id: string, submissionId: string) => `${base}/applications/${id}/submissions/${submissionId}`,
});

export type JourneyPaths = ReturnType<typeof journeyPaths>;

export const JOURNEY_PATHS: Record<JourneyMode, JourneyPaths> = {
  [JourneyMode.Borrower]: journeyPaths(AppPath.BorrowerHome, AppPath.BorrowerHome, AppPath.BorrowerNewApplication),
  [JourneyMode.Partner]: journeyPaths(AppPath.PartnerHome, AppPath.PartnerClients, AppPath.PartnerNewClient),
};

export const BORROWER_PATHS = JOURNEY_PATHS[JourneyMode.Borrower];

export const resumePath = (paths: JourneyPaths, application: { id: string; journeyStage: string }) => {
  const screen = screenForStage(application.journeyStage);
  return screen ? paths.step(application.id, screen) : paths.application(application.id);
};

export const RoutePath = {
  partnerLead: (id: string) => `${AppPath.PartnerLeads}/${id}`,
  adminChangeRequest: (id: string) => `${AppPath.AdminChangeRequests}/${id}`,
  adminImport: (id: string) => `${AppPath.AdminImports}/${id}`,
  adminUser: (id: string) => `${AppPath.AdminHome}/${id}`,
  lenderSubmission: (id: string) => `${AppPath.LenderHome}/submissions/${id}`,
  lenderProduct: (id: string) => `${AppPath.LenderProducts}/${id}`,
  opsLead: (id: string) => `${AppPath.OpsHome}/${id}`,
  opsCase: (id: string) => `${AppPath.OpsCases}/${id}`,
  opsSubmission: (id: string) => `${AppPath.OpsSubmissions}/${id}`,
  opsDocument: (id: string) => `/ops/documents/${id}`,
  opsParty: (partyId: string) => `/ops/parties/${partyId}`,
  opsMatchReview: (id: string) => `${AppPath.OpsMatchReviews}/${id}`,
};
