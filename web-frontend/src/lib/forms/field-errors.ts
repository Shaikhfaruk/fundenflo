import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';

export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): boolean {
  if (!(error instanceof ApiError)) return false;
  let applied = false;
  for (const issue of error.fieldIssues) {
    const field = fields.find((name) => issue.path === name || issue.path.startsWith(`${name}.`));
    if (!field) continue;
    setError(field, { type: issue.code, message: issue.message });
    applied = true;
  }
  return applied;
}
