import { Role } from '../../../common/enums/db.enums.js';

export const APPLICATION_REFRESH_BATCH = 50;

export const APPLICATION_TIMELINE_LIMIT = 100;

export const CO_PARTY_ROLES = ['co_applicant', 'guarantor', 'director'] as const;

export const CO_PARTIES_MAX = 10;

export const APPLICATION_PARTY_RELATIONSHIPS = ['spouse', 'parent', 'child', 'sibling', 'relative', 'business_partner', 'director', 'friend', 'other'] as const;

export const OPS_CASE_DOCUMENTS_LIMIT = 100;

export const CASE_ASSIGNEE_ROLES: readonly Role[] = [Role.ops_lead, Role.ops_reviewer, Role.credit_analyst];
