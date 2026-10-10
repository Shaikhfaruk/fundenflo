import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { JOURNEY_ORDER } from '@/lib/constants/status.constants';
import { cn } from '@/lib/utils';

export function JourneyStepper({ current, completed }: { current: string | null; completed: string[] }) {
  const t = useTranslations('journey');
  const done = new Set(completed);
  return (
    <ol className="flex flex-col gap-1">
      {JOURNEY_ORDER.map((stage, index) => {
        const isDone = done.has(stage);
        const isCurrent = stage === current && !isDone;
        return (
          <li key={stage} className={cn('flex items-center gap-3 rounded-lg px-2 py-2 text-sm', isCurrent && 'bg-primary/10 font-medium text-foreground')} aria-current={isCurrent ? 'step' : undefined}>
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular', isDone && 'border-primary bg-primary text-primary-foreground', isCurrent && 'border-primary text-primary')}>
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn(!isDone && !isCurrent && 'text-muted-foreground')}>{t(stage)}</span>
          </li>
        );
      })}
    </ol>
  );
}
