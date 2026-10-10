'use client';

import { motion } from 'motion/react';
import { useId } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Props = { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean; badge?: string; details?: string; className?: string };

export function ToggleRow({ title, description, checked, onCheckedChange, disabled, badge, details, className }: Props) {
  const id = useId();
  return (
    <motion.label htmlFor={id} whileTap={disabled ? undefined : { scale: 0.99 }} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border border-[#eef2f6] bg-card p-4 shadow-card transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30', checked && 'border-border', disabled && 'cursor-not-allowed opacity-70', className)}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-navy">
          {title}
          {badge ? <span className="rounded-xs bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-[#5d4200] uppercase">{badge}</span> : null}
        </span>
        <span className="text-xs/[18px] text-muted-foreground">{description}</span>
        {details ? <span className="mt-1 text-xs/[18px] text-foreground/70">{details}</span> : null}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
    </motion.label>
  );
}
