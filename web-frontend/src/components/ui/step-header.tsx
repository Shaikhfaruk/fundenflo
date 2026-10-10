'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

const BACK_CLASS = 'flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-subtle focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none active:scale-95';

type Props = { step?: number; total?: number; title?: string; onBack?: () => void; backHref?: string; className?: string };

export function StepHeader({ step, total = 6, title, onBack, backHref, className }: Props) {
  const t = useTranslations('common');
  const label = title ?? (step ? t('stepOf', { step, total }) : '');
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        {backHref ? (
          <Link href={backHref} aria-label={t('back')} className={cn(BACK_CLASS, '-ml-2.5')}>
            <Icon name="arrow-back" size={22} />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} aria-label={t('back')} className={cn(BACK_CLASS, '-ml-2.5')}>
            <Icon name="arrow-back" size={22} />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
        <p className="text-[15px] font-medium text-muted-foreground tabular">{label}</p>
        <span className="size-11" aria-hidden="true" />
      </div>
      {step !== undefined ? (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} aria-label={label} className="flex gap-1.5">
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-gold"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: index < step ? 1 : 0 }}
                transition={{ duration: Duration.Slow, ease: EASE_OUT, delay: index * STAGGER_STEP }}
              />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
