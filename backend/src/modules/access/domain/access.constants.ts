import { ConfigResource, LoginAs, OrganizationType, Role, SessionContext } from '../../../common/enums/db.enums.js';

type ActiveContext = Exclude<SessionContext, typeof SessionContext.none>;

export const CONTEXT_ROLES: Record<ActiveContext, Role[]> = {
  [SessionContext.borrower]: [Role.borrower, Role.business_owner, Role.authorised_signatory, Role.business_member],
  [SessionContext.partner]: [Role.partner_owner, Role.partner_agent],
  [SessionContext.lender]: [Role.lender_admin, Role.lender_credit_officer, Role.lender_viewer],
  [SessionContext.staff]: [
    Role.super_admin,
    Role.ops_lead,
    Role.ops_reviewer,
    Role.credit_analyst,
    Role.lender_manager,
    Role.partner_manager,
    Role.finance,
    Role.compliance_officer,
    Role.support,
  ],
};

export const ORGANIZATION_CONTEXT: Record<OrganizationType, ActiveContext> = {
  [OrganizationType.fundenflo]: SessionContext.staff,
  [OrganizationType.lender]: SessionContext.lender,
  [OrganizationType.partner]: SessionContext.partner,
  [OrganizationType.business]: SessionContext.borrower,
};

export const LOGIN_AS_CONTEXT: Record<LoginAs, ActiveContext> = {
  [LoginAs.borrower]: SessionContext.borrower,
  [LoginAs.ca]: SessionContext.partner,
  [LoginAs.dsa]: SessionContext.partner,
  [LoginAs.lender]: SessionContext.lender,
};

export const INVITATION_TTL_DAYS = 7;

export const INVITATION_TOKEN_BYTES = 32;

export const FUNDENFLO_ORGANIZATION_NAME = 'FundenFlo';

export const OPS_CONFIG_RESOURCES: ConfigResource[] = [ConfigResource.question_set, ConfigResource.routing_rule, ConfigResource.document_requirement, ConfigResource.lender_product];

export const COMPLIANCE_CONFIG_RESOURCES: ConfigResource[] = [ConfigResource.consent_template];

export const LENDER_CONFIG_RESOURCES: ConfigResource[] = [ConfigResource.lender_product];

export const CREDIT_CONFIG_RESOURCES: ConfigResource[] = [ConfigResource.scoring_model, ConfigResource.improvement_rule];

export const ApiScope = {
  LeadsCreate: 'leads:create',
} as const;

export type ApiScope = (typeof ApiScope)[keyof typeof ApiScope];

export const API_KEY_PREFIX = 'ffk';

export const API_KEY_PREFIX_BYTES = 6;

export const API_KEY_SECRET_BYTES = 32;

export const API_KEY_PATTERN = /^ffk_([A-Za-z0-9_-]{8})\.([A-Za-z0-9_-]{43})$/;

export const API_KEY_RATE_LIMIT = { name: 'api-key', limit: 120, windowSeconds: 60 } as const;

export const API_KEY_LAST_USED_RESOLUTION_MS = 60_000;
