import { ErrorCode } from '@/lib/constants/errors.constants';
import { ApiError } from './api-error';

type Translate = (key: string, values?: Record<string, string | number>) => string;
type HasKey = (key: string) => boolean;

const sentence = (text: string) => (text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}` : text);

export function errorMessage(error: unknown, t: Translate, has: HasKey): string {
  if (!(error instanceof ApiError)) return t('generic');
  if ((error.code === ErrorCode.RateLimited || error.code === ErrorCode.OtpCooldown) && error.retryAfterSeconds) return t('retryAfter', { seconds: error.retryAfterSeconds });
  const issue = error.code === ErrorCode.ValidationFailed ? error.fieldIssues[0] : undefined;
  if (issue?.code && has(`issues.${issue.code}`)) return t(`issues.${issue.code}`);
  if (issue?.message) return sentence(issue.message);
  if (has(error.code)) return t(error.code);
  return error.message || t('generic');
}

export const supportReference = (error: unknown) => (error instanceof ApiError ? error.requestId : null);
