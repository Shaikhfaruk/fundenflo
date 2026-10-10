import type { AbilityBuilder } from '@casl/ability';

import type { UserActor } from '../../../common/context/actor.js';
import { OrganizationType, Role } from '../../../common/enums/db.enums.js';
import { AppAction, type AppAbility, NonModelSubject } from './ability.types.js';
import { COMPLIANCE_CONFIG_RESOURCES, CREDIT_CONFIG_RESOURCES, FINANCE_CONFIG_RESOURCES, LENDER_CONFIG_RESOURCES, OPS_CONFIG_RESOURCES } from './access.constants.js';

type Builder = AbilityBuilder<AppAbility>;

type Grant = (builder: Builder, actor: UserActor) => void;

const MANAGE_SCOPED: AppAction[] = [AppAction.Create, AppAction.Read, AppAction.Update];

const CONFIG_MAKER: AppAction[] = [AppAction.Create, AppAction.Update, AppAction.Publish];

const manageOrganizationMembers = (type: OrganizationType): Grant => ({ can }) => {
  can(AppAction.Read, 'User');
  can(AppAction.Read, 'Organization', { type });
  can(MANAGE_SCOPED, 'Membership', { organization: { is: { type } } });
  can(MANAGE_SCOPED, 'Invitation', { organization: { is: { type } } });
};

const ownBorrowing: Grant = ({ can }, { userId }) => {
  const own = { actingParty: { is: { user: { is: { id: userId } } } } };
  can([AppAction.Create, AppAction.Read, AppAction.Update], ['BorrowerProfile', 'LoanApplication'], own);
  can([AppAction.Create, AppAction.Read, AppAction.Delete, AppAction.Download], 'Document', { borrowerProfile: { is: own } });
  can([AppAction.Create, AppAction.Read, AppAction.Update], 'LenderSubmission', { application: { is: own } });
  can(AppAction.Read, 'DocumentRequest', { application: { is: own } });
};

export const ROLE_GRANTS: Partial<Record<Role, Grant>> = {
  [Role.super_admin]: ({ can }) => {
    can(AppAction.Manage, 'all');
  },
  [Role.ops_lead]: ({ can }) => {
    can([AppAction.Read, AppAction.Update], 'User');
    can(AppAction.Read, ['Membership', 'Invitation', 'Organization', 'AuditEvent']);
    can(AppAction.Manage, NonModelSubject.Catalog);
    can(AppAction.Manage, 'AttributeDefinition');
    can([AppAction.Read, AppAction.Update], 'Party');
    can(AppAction.Manage, 'Question');
    can(AppAction.Manage, 'DocumentType');
    can(AppAction.Read, 'ConsentPurpose');
    can([AppAction.Read, AppAction.Update], 'PartnerProfile');
    can([AppAction.Read, AppAction.Approve], 'ConfigDocument');
    can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: OPS_CONFIG_RESOURCES } });
    can(AppAction.Manage, ['ApiClient', 'Lead', 'LeadAssignment', 'LeadSource', 'ImportBatch', 'Activity', 'FollowUp', 'OfflineConversion', 'BorrowerProfile', 'LoanApplication', 'Document', 'Lender', 'LenderAgreement', 'LenderContact', 'LenderSubmission', 'DocumentRequest', 'AttributionDispute', 'RiskSignal', 'FraudReview']);
  },
  [Role.ops_reviewer]: ({ can }) => {
    can([AppAction.Read, AppAction.Update], ['Lead', 'Party']);
    can([AppAction.Read, AppAction.Update, AppAction.Assign], 'LeadAssignment');
    can([AppAction.Create, AppAction.Read], 'Activity');
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'FollowUp');
    can(AppAction.Read, 'OfflineConversion');
    can([AppAction.Read, AppAction.Update], ['BorrowerProfile', 'LoanApplication']);
    can([AppAction.Read, AppAction.Update, AppAction.Download], 'Document');
    can([AppAction.Read, AppAction.Update], ['LenderSubmission', 'DocumentRequest']);
    can(AppAction.Read, 'AttributionDispute');
    can(AppAction.Read, 'RiskSignal');
    can([AppAction.Read, AppAction.Update], 'FraudReview');
    can(AppAction.Read, ['LeadSource', 'AttributeDefinition', 'Question', 'ConsentPurpose', 'PartnerProfile', 'DocumentType', 'Lender', NonModelSubject.Catalog]);
  },
  [Role.credit_analyst]: ({ can }) => {
    can(AppAction.Read, ['AttributeDefinition', 'Question', 'DocumentType', 'Party', 'BorrowerProfile', 'Lender', 'RiskSignal', 'FraudReview', NonModelSubject.Catalog]);
    can([AppAction.Read, AppAction.Update], 'LoanApplication');
    can([AppAction.Read, AppAction.Download], 'Document');
    can([AppAction.Read, AppAction.Approve], 'ConfigDocument', { resource: { in: CREDIT_CONFIG_RESOURCES } });
    can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: CREDIT_CONFIG_RESOURCES } });
  },
  [Role.finance]: ({ can }) => {
    can(AppAction.Manage, ['Receivable', 'PartnerPayout', 'ReconciliationRun']);
    can(AppAction.Read, ['LedgerEntry', 'Lender', 'LenderAgreement', 'LenderSubmission', 'PartnerProfile', 'LoanApplication', 'Organization']);
    can(AppAction.Read, 'ConfigDocument', { resource: { in: FINANCE_CONFIG_RESOURCES } });
    can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: FINANCE_CONFIG_RESOURCES } });
  },
  [Role.compliance_officer]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', 'Invitation', 'Organization', 'AuditEvent', 'AttributeDefinition', 'Party', 'Question', 'DocumentType', NonModelSubject.Catalog]);
    can(AppAction.Manage, 'ConsentPurpose');
    can(AppAction.Read, ['PartnerProfile', 'ApiClient', 'Lead', 'LeadAssignment', 'LeadSource', 'ImportBatch', 'Activity', 'FollowUp', 'OfflineConversion', 'BorrowerProfile', 'LoanApplication']);
    can([AppAction.Read, AppAction.Download], 'Document');
    can(AppAction.Read, ['Lender', 'LenderAgreement', 'LenderContact', 'LenderSubmission', 'DocumentRequest', 'AttributionDispute', 'Receivable', 'PartnerPayout', 'ReconciliationRun', 'LedgerEntry', 'RiskSignal', 'FraudReview']);
    can([AppAction.Read, AppAction.Approve], 'ConfigDocument');
    can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: COMPLIANCE_CONFIG_RESOURCES } });
  },
  [Role.support]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', 'AttributeDefinition', 'Party', 'Question', 'ConfigDocument', 'ConsentPurpose', 'PartnerProfile', 'Lead', 'LeadAssignment', 'LeadSource', 'Activity', 'FollowUp', 'OfflineConversion', 'DocumentType', 'BorrowerProfile', 'LoanApplication', 'Document', 'Lender', 'LenderSubmission', 'DocumentRequest', NonModelSubject.Catalog]);
  },
  [Role.partner_manager]: (builder, actor) => {
    manageOrganizationMembers(OrganizationType.partner)(builder, actor);
    builder.can([AppAction.Read, AppAction.Update], 'PartnerProfile');
  },
  [Role.partner_owner]: ({ can }, { organizationId }) => {
    if (!organizationId) return;
    can([AppAction.Read, AppAction.Update], 'PartnerProfile', { organizationId });
    can(AppAction.Read, ['Membership', 'Invitation'], { organizationId });
    can([AppAction.Create, AppAction.Update], ['Membership', 'Invitation'], { organizationId, role: Role.partner_agent });
    can([AppAction.Read, AppAction.Update, AppAction.Assign], 'LeadAssignment', { organizationId });
    can(AppAction.Create, 'Lead');
    can([AppAction.Create, AppAction.Read], 'Activity', { organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'FollowUp', { organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], ['BorrowerProfile', 'LoanApplication'], { partnerOrganizationId: organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Delete, AppAction.Download], 'Document', { partnerOrganizationId: organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'LenderSubmission', { application: { is: { partnerOrganizationId: organizationId } } });
    can(AppAction.Read, 'DocumentRequest', { application: { is: { partnerOrganizationId: organizationId } } });
  },
  [Role.partner_agent]: ({ can }, { organizationId, membershipId, userId }) => {
    if (!organizationId || !membershipId) return;
    can(AppAction.Read, 'PartnerProfile', { organizationId });
    can([AppAction.Read, AppAction.Update], 'LeadAssignment', { organizationId, assigneeMembershipId: membershipId });
    can(AppAction.Create, 'Lead');
    can([AppAction.Create, AppAction.Read], 'Activity', { organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'FollowUp', { organizationId, assigneeMembershipId: membershipId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], ['BorrowerProfile', 'LoanApplication'], { partnerOrganizationId: organizationId, createdByUserId: userId });
    can([AppAction.Create, AppAction.Read, AppAction.Delete, AppAction.Download], 'Document', { partnerOrganizationId: organizationId, borrowerProfile: { is: { createdByUserId: userId } } });
    can([AppAction.Create, AppAction.Read, AppAction.Delete, AppAction.Download], 'Document', { partnerOrganizationId: organizationId, application: { is: { createdByUserId: userId } } });
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'LenderSubmission', { application: { is: { partnerOrganizationId: organizationId, createdByUserId: userId } } });
    can(AppAction.Read, 'DocumentRequest', { application: { is: { partnerOrganizationId: organizationId, createdByUserId: userId } } });
  },
  [Role.lender_manager]: (builder, actor) => {
    manageOrganizationMembers(OrganizationType.lender)(builder, actor);
    builder.can(AppAction.Manage, ['Lender', 'LenderAgreement', 'LenderContact']);
    builder.can(AppAction.Read, ['AttributeDefinition', 'Question', 'DocumentType', NonModelSubject.Catalog]);
    builder.can([AppAction.Read, AppAction.Approve], 'ConfigDocument', { resource: { in: LENDER_CONFIG_RESOURCES } });
    builder.can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: LENDER_CONFIG_RESOURCES } });
    builder.can([AppAction.Create, AppAction.Read, AppAction.Download], 'Document', { borrowerProfileId: null, applicationId: null });
  },
  [Role.lender_admin]: ({ can }, { organizationId }) => {
    if (!organizationId) return;
    can([AppAction.Read, AppAction.Update], 'Lender', { organizationId });
    can([AppAction.Read, AppAction.Update], 'LenderSubmission', { lenderOrganizationId: organizationId });
    can(AppAction.Create, 'Document');
  },
  [Role.lender_credit_officer]: ({ can }, { organizationId }) => {
    if (!organizationId) return;
    can(AppAction.Read, 'Lender', { organizationId });
    can([AppAction.Read, AppAction.Update], 'LenderSubmission', { lenderOrganizationId: organizationId });
    can(AppAction.Create, 'Document');
  },
  [Role.lender_viewer]: ({ can }, { organizationId }) => {
    if (!organizationId) return;
    can(AppAction.Read, 'Lender', { organizationId });
    can(AppAction.Read, 'LenderSubmission', { lenderOrganizationId: organizationId });
  },
  [Role.borrower]: ownBorrowing,
  [Role.business_owner]: ownBorrowing,
  [Role.authorised_signatory]: ownBorrowing,
  [Role.business_member]: ownBorrowing,
};

export const SELF_GRANT: Grant = ({ can }, actor) => {
  can(AppAction.Read, 'User', { id: actor.userId });
  can([AppAction.Read, AppAction.Delete], 'Session', { userId: actor.userId });
};
