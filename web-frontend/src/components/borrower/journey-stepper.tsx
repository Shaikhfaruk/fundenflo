'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { JOURNEY_ORDER } from '@/lib/constants/status.constants';
import { cn } from '@/lib/utils';

const ROW_STEP = 0.05;

export function JourneyStepper({ current, completed, activeDetail }: { current: string | null; completed: string[]; activeDetail?: ReactNode }) {
  const t = useTranslations('journey');
  const tOverview = useTranslations('borrower.overview');
  const done = new Set(completed);
  return (
    <ol className="flex flex-col">
      {JOURNEY_ORDER.map((stage, index) => {
        const isDone = done.has(stage);
        const isCurrent = stage === current && !isDone;
        const last = index === JOURNEY_ORDER.length - 1;
        return (
          <motion.li key={stage} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * ROW_STEP, duration: Duration.Base, ease: EASE_OUT }} className="flex gap-3" aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex w-[22px] flex-col items-center">
              <span className={cn('relative flex size-[22px] shrink-0 items-center justify-center rounded-full bg-border text-white', isDone && 'bg-success', isCurrent && 'bg-gold')}>
                {isDone ? <Icon name="check" size={13} /> : null}
                {isCurrent ? <span className="absolute inset-0 animate-ping rounded-full bg-gold/50" aria-hidden="true" /> : null}
              </span>
              {last ? null : (
                <span className="relative my-0.5 min-h-7 w-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  {isDone ? <motion.span className="absolute inset-0 origin-top bg-success" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.2 + index * ROW_STEP, duration: Duration.Base }} /> : null}
                </span>
              )}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col pb-4', last && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className={cn('flex-1 text-[15px] font-semibold text-foreground', !isDone && !isCurrent && 'font-medium text-muted-foreground')}>{t(stage)}</span>
                {isCurrent ? <span className="rounded-xs bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-navy uppercase">{tOverview('activeTag')}</span> : null}
              </div>
              <span className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">{isDone ? tOverview('done') : isCurrent ? (activeDetail ?? tOverview('inProgress')) : tOverview('upcoming')}</span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
