import type { AbilityBuilder } from '@casl/ability';

import type { UserActor } from '../../../common/context/actor.js';
import { OrganizationType, Role } from '../../../common/enums/db.enums.js';
import { AppAction, type AppAbility, NonModelSubject } from './ability.types.js';
import { COMPLIANCE_CONFIG_RESOURCES, OPS_CONFIG_RESOURCES } from './access.constants.js';

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
    can(AppAction.Manage, ['ApiClient', 'Lead', 'LeadAssignment', 'LeadSource', 'ImportBatch', 'Activity', 'FollowUp', 'OfflineConversion']);
  },
  [Role.ops_reviewer]: ({ can }) => {
    can([AppAction.Read, AppAction.Update], ['Lead', 'Party']);
    can([AppAction.Read, AppAction.Update, AppAction.Assign], 'LeadAssignment');
    can([AppAction.Create, AppAction.Read], 'Activity');
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'FollowUp');
    can(AppAction.Read, 'OfflineConversion');
    can(AppAction.Read, ['LeadSource', 'AttributeDefinition', 'Question', 'ConsentPurpose', 'PartnerProfile', 'DocumentType', NonModelSubject.Catalog]);
  },
  [Role.compliance_officer]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', 'Invitation', 'Organization', 'AuditEvent', 'AttributeDefinition', 'Party', 'Question', 'DocumentType', NonModelSubject.Catalog]);
    can(AppAction.Manage, 'ConsentPurpose');
    can(AppAction.Read, ['PartnerProfile', 'ApiClient', 'Lead', 'LeadAssignment', 'LeadSource', 'ImportBatch', 'Activity', 'FollowUp', 'OfflineConversion']);
    can([AppAction.Read, AppAction.Approve], 'ConfigDocument');
    can(CONFIG_MAKER, 'ConfigDocument', { resource: { in: COMPLIANCE_CONFIG_RESOURCES } });
  },
  [Role.support]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', 'AttributeDefinition', 'Party', 'Question', 'ConfigDocument', 'ConsentPurpose', 'PartnerProfile', 'Lead', 'LeadAssignment', 'LeadSource', 'Activity', 'FollowUp', 'OfflineConversion', 'DocumentType', NonModelSubject.Catalog]);
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
  },
  [Role.partner_agent]: ({ can }, { organizationId, membershipId }) => {
    if (!organizationId || !membershipId) return;
    can(AppAction.Read, 'PartnerProfile', { organizationId });
    can([AppAction.Read, AppAction.Update], 'LeadAssignment', { organizationId, assigneeMembershipId: membershipId });
    can(AppAction.Create, 'Lead');
    can([AppAction.Create, AppAction.Read], 'Activity', { organizationId });
    can([AppAction.Create, AppAction.Read, AppAction.Update], 'FollowUp', { organizationId, assigneeMembershipId: membershipId });
  },
  [Role.lender_manager]: manageOrganizationMembers(OrganizationType.lender),
};

export const SELF_GRANT: Grant = ({ can }, actor) => {
  can(AppAction.Read, 'User', { id: actor.userId });
  can([AppAction.Read, AppAction.Delete], 'Session', { userId: actor.userId });
};
