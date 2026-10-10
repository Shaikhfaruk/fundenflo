'use client';

import { motion } from 'motion/react';

import { AnimatedNumber } from '@/components/motion/animated-number';
import type { IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

const TONE = {
  navy: { tile: 'subtle', bar: 'bg-navy' },
  gold: { tile: 'goldSoft', bar: 'bg-gold' },
  success: { tile: 'success', bar: 'bg-success' },
  info: { tile: 'info', bar: 'bg-info' },
  danger: { tile: 'danger', bar: 'bg-destructive' },
} as const;

export type StatTone = keyof typeof TONE;

const plain = (value: number) => value.toLocaleString('en-IN');

export function StatCard({ label, value, icon, tone = 'navy', hint, progress, format = plain, delay = 0 }: { label: string; value: number; icon: IconName; tone?: StatTone; hint?: string; progress?: number; format?: (value: number) => string; delay?: number }) {
  const fill = Math.min(1, Math.max(0, progress ?? 0));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: Duration.Slow, ease: EASE_OUT }} whileHover={{ y: -2 }} className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[#eef2f6] bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[12rem] text-[11px] leading-4 font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
        <IconTile icon={icon} tone={TONE[tone].tile} size="md" />
      </div>
      <AnimatedNumber value={value} format={format} className="font-heading text-[32px] leading-9 font-semibold text-navy tabular" />
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
      <span className={cn('absolute bottom-0 left-0 h-1', progress === undefined ? 'w-16' : 'inset-x-0 bg-subtle')} aria-hidden="true">
        <motion.span className={cn('block h-full origin-left', TONE[tone].bar)} initial={{ scaleX: 0 }} animate={{ scaleX: progress === undefined ? 1 : fill }} transition={{ delay: delay + 0.2, duration: Duration.Slow, ease: EASE_OUT }} />
      </span>
    </motion.div>
  );
}
