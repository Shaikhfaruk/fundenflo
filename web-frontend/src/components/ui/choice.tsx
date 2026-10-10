'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { ZoomIn } from '@/components/motion/zoom-in';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { cn } from '@/lib/utils';

type ChoiceProps = {
  selected: boolean;
  onSelect: () => void;
  icon: IconName;
  title: string;
  description?: string | null;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
};

const PRESS = { scale: 0.985 } as const;

export function ChoiceRow({ selected, onSelect, icon, title, description, disabled, badge, className }: ChoiceProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : PRESS}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-xl border-[1.5px] border-transparent bg-card p-4 text-left shadow-card transition-[background-color,border-color] duration-200 outline-none hover:border-border focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60',
        selected && 'border-border bg-subtle',
        className,
      )}
    >
      <IconTile icon={icon} size="lg" tone={selected ? 'card' : 'subtle'} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-heading text-base font-semibold text-foreground">
          {title}
          {badge}
        </span>
        {description ? <span className="text-xs/[18px] text-muted-foreground">{description}</span> : null}
      </span>
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border-[3px] border-border" aria-hidden="true">
        <ZoomIn show={selected} className="absolute -inset-[3px] flex items-center justify-center rounded-full bg-gold-deep text-white">
          <Icon name="check" size={14} />
        </ZoomIn>
      </span>
    </motion.button>
  );
}

export function ChoiceTile({ selected, onSelect, icon, title, description, disabled, badge, className }: ChoiceProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      whileTap={disabled ? undefined : PRESS}
      className={cn(
        'flex min-h-[118px] w-full flex-col justify-between gap-3.5 rounded-xl border border-transparent bg-card p-3.5 text-left shadow-card transition-[background-color,border-color,box-shadow] duration-200 outline-none hover:border-border focus-visible:ring-3 focus-visible:ring-ring/30',
        selected && 'border-border bg-background shadow-[0_4px_14px_-2px_rgba(10,25,47,0.12)]',
        disabled && 'cursor-not-allowed bg-subtle shadow-none hover:border-transparent',
        className,
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <IconTile icon={icon} size="sm" tone={disabled ? 'muted' : selected ? 'navy' : 'subtle'} />
        {disabled ? (
          badge
        ) : (
          <ZoomIn show={selected} className="flex size-[22px] items-center justify-center rounded-full bg-gold text-navy">
            <Icon name="check" size={13} />
          </ZoomIn>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn('text-[15px]/5 font-medium text-foreground', selected && 'font-semibold text-navy', disabled && 'text-slate')}>{title}</span>
        {description ? <span className={cn('text-[11px]/[15px] text-muted-foreground', disabled && 'text-slate')}>{description}</span> : null}
      </span>
    </motion.button>
  );
}

export function ChoiceChip({ selected, onToggle, label, className }: { selected: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      whileTap={PRESS}
      onClick={onToggle}
      className={cn('flex min-h-11 items-center gap-2 rounded-lg border border-[#eef2f6] bg-card px-3 text-sm font-semibold text-foreground shadow-soft transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30', selected && 'border-navy bg-navy text-white shadow-lift', className)}
    >
      {label}
      {selected ? <Icon name="check" size={15} className="text-gold" /> : null}
    </motion.button>
  );
}
