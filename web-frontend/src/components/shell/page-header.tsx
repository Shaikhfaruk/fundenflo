'use client';

import type { ReactNode } from 'react';

import { FadeIn } from '@/components/motion/fade-in';
import { Eyebrow } from '@/components/ui/eyebrow';

export function PageHeader({ title, description, eyebrow, badge, actions }: { title: string; description?: string; eyebrow?: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <FadeIn className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground lg:text-[28px] lg:leading-9">{title}</h1>
          {badge}
        </div>
        {description ? <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </FadeIn>
  );
}
