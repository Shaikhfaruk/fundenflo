import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const StatusTone = {
  Neutral: 'neutral',
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
} as const;

export type StatusTone = (typeof StatusTone)[keyof typeof StatusTone];

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  danger: 'bg-destructive/15 text-destructive',
};

export function StatusBadge({ status, tone, namespace = 'status' }: { status: string; tone: StatusTone; namespace?: string }) {
  const t = useTranslations(namespace);
  return (
    <Badge variant="secondary" className={cn('border-transparent font-medium', TONE_CLASS[tone])}>
      {t.has(status) ? t(status) : status.replaceAll('_', ' ')}
    </Badge>
  );
}
