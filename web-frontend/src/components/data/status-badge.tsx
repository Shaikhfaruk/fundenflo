import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { StatusTone } from '@/lib/constants/status.constants';

const TONE_VARIANT = {
  neutral: 'secondary',
  info: 'info',
  success: 'success',
  warning: 'gold',
  danger: 'destructive',
  strong: 'default',
} as const satisfies Record<StatusTone, string>;

export function StatusBadge({ status, tone, namespace = 'status' }: { status: string; tone: StatusTone; namespace?: string }) {
  const t = useTranslations(namespace);
  return (
    <Badge variant={TONE_VARIANT[tone]} className="uppercase tracking-[0.06em] text-[10.5px]">
      {t.has(status) ? t(status) : status.replaceAll('_', ' ')}
    </Badge>
  );
}
