'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

export function Section({ title, action, children, className, delay = 0 }: { title: string; action?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: Duration.Base, ease: EASE_OUT }} className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 shadow-card', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

export type KeyValue = { label: string; value: ReactNode };

export function KeyValues({ items, columns = 2 }: { items: KeyValue[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-3 text-sm', columns === 1 && 'grid-cols-1', columns === 2 && 'grid-cols-1 sm:grid-cols-2', columns === 3 && 'grid-cols-2 lg:grid-cols-3')}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-medium break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
