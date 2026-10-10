import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function SecureNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-muted-foreground', className)}>
      <Icon name="lock" size={13} className="shrink-0" />
      <span className="text-pretty">{children}</span>
    </p>
  );
}
