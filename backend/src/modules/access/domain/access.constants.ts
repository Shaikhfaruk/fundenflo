import { LoginAs, OrganizationType, Role, SessionContext } from '../../../common/enums/db.enums.js';

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
