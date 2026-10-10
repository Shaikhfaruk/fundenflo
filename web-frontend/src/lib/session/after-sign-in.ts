import type { SessionPayload } from '@/lib/api/types/auth.types';
import { NextActionCode, SessionContext } from '@/lib/constants/auth.constants';
import { AppPath, HOME_BY_CONTEXT } from '@/lib/constants/routes.constants';

const isSafeNext = (value: string | null): value is string => Boolean(value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/api'));

export function destinationAfterSignIn(payload: SessionPayload, next: string | null): string {
  const code = payload.nextAction?.code;
  if (code === NextActionCode.PartnerNotOnboarded) return AppPath.PartnerSignup;
  if (code === NextActionCode.MembershipRequired || code === NextActionCode.MembershipSuspended) return AppPath.AccountSwitch;
  if (isSafeNext(next)) return next;
  return HOME_BY_CONTEXT[payload.user.activeContext?.context ?? SessionContext.None] ?? AppPath.AccountSwitch;
}
