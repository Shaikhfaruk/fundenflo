'use client';

import type { ReactNode } from 'react';

import { FadeIn } from '@/components/motion/fade-in';
import type { IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { cn } from '@/lib/utils';

export function EmptyState({ icon, title, body, action, className }: { icon: IconName; title?: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <FadeIn className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-center', className)}>
      <span className="relative mt-4 flex items-center justify-center">
        <span className="absolute size-20 rounded-full bg-gold-soft/70" aria-hidden="true" />
        <IconTile icon={icon} tone="goldSoft" size="lg" className="relative bg-card shadow-card" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        {title ? <h2 className="font-heading text-lg font-semibold text-navy">{title}</h2> : null}
        {body ? <p className="text-sm text-pretty text-muted-foreground">{body}</p> : null}
      </div>
      {action ? <div className="mb-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </FadeIn>
  );
}
