import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Eyebrow({ children, dot = true, className }: { children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase', className)}>
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" /> : null}
      {children}
    </p>
  );
}
