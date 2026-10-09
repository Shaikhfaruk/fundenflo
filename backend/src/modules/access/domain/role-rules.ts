import type { Role, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { CONTEXT_ROLES } from './access.constants.js';

const rolesFor = (context: SessionContext): Role[] => (CONTEXT_ROLES as Partial<Record<SessionContext, Role[]>>)[context] ?? [];

export const isRoleAllowed = (context: SessionContext, role: Role): boolean => rolesFor(context).includes(role);

export function assertRoleAllowed(context: SessionContext, role: Role) {
  const allowed = rolesFor(context);
  if (!allowed.includes(role)) {
    throw new AppError(ErrorCode.ROLE_NOT_ALLOWED, { details: { context, role, allowedRoles: allowed } });
  }
}
