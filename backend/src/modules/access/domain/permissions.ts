import type { AbilityBuilder } from '@casl/ability';

import type { UserActor } from '../../../common/context/actor.js';
import { OrganizationType, Role } from '../../../common/enums/db.enums.js';
import { AppAction, type AppAbility, NonModelSubject } from './ability.types.js';

type Builder = AbilityBuilder<AppAbility>;

type Grant = (builder: Builder, actor: UserActor) => void;

const MANAGE_SCOPED: AppAction[] = [AppAction.Create, AppAction.Read, AppAction.Update];

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
  },
  [Role.compliance_officer]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', 'Invitation', 'Organization', 'AuditEvent', NonModelSubject.Catalog]);
  },
  [Role.support]: ({ can }) => {
    can(AppAction.Read, ['User', 'Membership', NonModelSubject.Catalog]);
  },
  [Role.partner_manager]: manageOrganizationMembers(OrganizationType.partner),
  [Role.lender_manager]: manageOrganizationMembers(OrganizationType.lender),
};

export const SELF_GRANT: Grant = ({ can }, actor) => {
  can(AppAction.Read, 'User', { id: actor.userId });
  can([AppAction.Read, AppAction.Delete], 'Session', { userId: actor.userId });
};
