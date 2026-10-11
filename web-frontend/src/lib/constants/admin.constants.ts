import type { IconName } from '@/components/ui/icon';

import { Role } from './auth.constants';
import { AppPath } from './routes.constants';

export const ConfigResource = {
  QuestionSet: 'question_set',
  RoutingRule: 'routing_rule',
  ConsentTemplate: 'consent_template',
  DocumentRequirement: 'document_requirement',
  LenderProduct: 'lender_product',
  ScoringModel: 'scoring_model',
  ImprovementRule: 'improvement_rule',
  CommissionScheme: 'commission_scheme',
} as const;

export type ConfigResource = (typeof ConfigResource)[keyof typeof ConfigResource];

export const ConfigAction = { Edit: 'edit', Submit: 'submit', Approve: 'approve', Reject: 'reject', Publish: 'publish', Retire: 'retire' } as const;

export const ChangeRequestStatus = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Withdrawn: 'withdrawn' } as const;

export const CHANGE_REQUEST_STATUSES = [ChangeRequestStatus.Pending, ChangeRequestStatus.Approved, ChangeRequestStatus.Rejected, ChangeRequestStatus.Withdrawn] as const;

export const CATALOG_STATUSES = ['active', 'inactive'] as const;

export const CatalogStatus = { Active: 'active', Inactive: 'inactive' } as const;

export const CONFIG_NOTE_MIN_LENGTH = 3;

export const CONFIG_NOTE_MAX_LENGTH = 1_000;

export const CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

const STAFF_READERS: readonly string[] = [Role.SuperAdmin, Role.OpsLead, Role.ComplianceOfficer, Role.Support];

export type ConfigResourceMeta = { path: string; nav: string; icon: IconName; roles: readonly string[] };

export const CONFIG_RESOURCE_META: Record<ConfigResource, ConfigResourceMeta> = {
  [ConfigResource.QuestionSet]: { path: AppPath.AdminQuestionSets, nav: 'questionSets', icon: 'list', roles: STAFF_READERS },
  [ConfigResource.RoutingRule]: { path: AppPath.AdminRoutingRules, nav: 'routingRules', icon: 'sync-alt', roles: STAFF_READERS },
  [ConfigResource.ConsentTemplate]: { path: AppPath.AdminConsentTemplates, nav: 'consentTemplates', icon: 'shield', roles: STAFF_READERS },
  [ConfigResource.DocumentRequirement]: { path: AppPath.AdminDocumentRequirements, nav: 'documentRequirements', icon: 'document', roles: STAFF_READERS },
  [ConfigResource.LenderProduct]: { path: AppPath.AdminLenderProducts, nav: 'lenderProducts', icon: 'assignment', roles: [...STAFF_READERS, Role.LenderManager] },
  [ConfigResource.ScoringModel]: { path: AppPath.AdminScoringModels, nav: 'scoringModels', icon: 'monitoring', roles: [...STAFF_READERS, Role.CreditAnalyst] },
  [ConfigResource.ImprovementRule]: { path: AppPath.AdminImprovementRules, nav: 'improvementRules', icon: 'trending-up', roles: [...STAFF_READERS, Role.CreditAnalyst] },
  [ConfigResource.CommissionScheme]: { path: AppPath.AdminCommissionSchemes, nav: 'commissionSchemes', icon: 'payments', roles: [...STAFF_READERS, Role.Finance] },
};

export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;

export const UserStatus = { Active: 'active', Suspended: 'suspended' } as const;

export const MEMBERSHIP_STATUSES = ['active', 'suspended', 'revoked'] as const;

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;

export const InvitationStatus = { Pending: 'pending' } as const;

export const OrganizationType = { FundenFlo: 'fundenflo', Lender: 'lender', Partner: 'partner' } as const;

export const OrganizationStatus = { Pending: 'pending', Active: 'active', Suspended: 'suspended', Closed: 'closed' } as const;

export const ROLES_BY_ORGANIZATION: Record<string, readonly string[]> = {
  [OrganizationType.FundenFlo]: [Role.SuperAdmin, Role.OpsLead, Role.OpsReviewer, Role.CreditAnalyst, Role.LenderManager, Role.PartnerManager, Role.Finance, Role.ComplianceOfficer, Role.Support],
  [OrganizationType.Lender]: [Role.LenderAdmin, Role.LenderCreditOfficer, Role.LenderViewer],
  [OrganizationType.Partner]: [Role.PartnerOwner, Role.PartnerAgent],
};

export const PARTNER_VERIFICATION_STATUSES = ['pending', 'in_review', 'verified', 'rejected'] as const;

export const PARTNER_LEVELS = ['new', 'active', 'strategic'] as const;

export const VerificationDecision = { Approve: 'approve', Reject: 'reject' } as const;

export const PARTNER_NOTE_MIN_LENGTH = 3;

export const IMPORT_STATUSES = ['awaiting_upload', 'uploaded', 'mapped', 'validating', 'validated', 'committing', 'committed', 'undoing', 'undone', 'failed'] as const;

export const ImportStatus = { AwaitingUpload: 'awaiting_upload', Uploaded: 'uploaded', Mapped: 'mapped', Validating: 'validating', Validated: 'validated', Committing: 'committing', Committed: 'committed', Undoing: 'undoing', Failed: 'failed' } as const;

export const IMPORT_BUSY_STATUSES: readonly string[] = [ImportStatus.Validating, ImportStatus.Committing, ImportStatus.Undoing];

export const ImportKind = { Leads: 'leads' } as const;

export const IMPORT_ACCEPT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type AdminTab = { key: string; href: string };

export const ADMIN_TABS = {
  catalog: [
    { key: 'segments', href: AppPath.AdminSegments },
    { key: 'categories', href: AppPath.AdminCategories },
    { key: 'cities', href: AppPath.AdminCities },
    { key: 'pincodes', href: AppPath.AdminPincodes },
    { key: 'aliases', href: AppPath.AdminAliases },
  ],
  attributes: [
    { key: 'attributes', href: AppPath.AdminAttributes },
    { key: 'playground', href: AppPath.AdminConditions },
  ],
  consents: [
    { key: 'purposes', href: AppPath.AdminConsentPurposes },
    { key: 'templates', href: AppPath.AdminConsentTemplates },
  ],
  leadSources: [
    { key: 'sources', href: AppPath.AdminLeadSources },
    { key: 'apiClients', href: AppPath.AdminApiClients },
  ],
  documents: [
    { key: 'types', href: AppPath.AdminDocumentTypes },
    { key: 'requirements', href: AppPath.AdminDocumentRequirements },
  ],
} satisfies Record<string, AdminTab[]>;

export type AdminTabGroup = keyof typeof ADMIN_TABS;

export const RECEIVABLE_STATUSES = ['accrued', 'invoiced', 'received', 'reconciled', 'written_off'] as const;

export const ReceivableStatus = { Accrued: 'accrued', Invoiced: 'invoiced', Received: 'received', Reconciled: 'reconciled', WrittenOff: 'written_off' } as const;

export const ReceivableAction = { Invoice: 'invoice', Receive: 'receive', Reconcile: 'reconcile', WriteOff: 'write_off' } as const;

export const PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const;

export const PayoutStatus = { Pending: 'pending', Approved: 'approved', Paid: 'paid', Reversed: 'reversed' } as const;

export const RECONCILIATION_SOURCES = ['lender_statement', 'bank_statement'] as const;

export const UTR_PATTERN = /^[A-Za-z0-9]{6,30}$/;

export const FINANCE_NOTE_MIN_LENGTH = 3;

export const FINANCE_NOTE_MAX_LENGTH = 500;
