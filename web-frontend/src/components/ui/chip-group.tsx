import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function ChipGroup({ label, showLabel = false, children, className }: { label: string; showLabel?: boolean; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)}>
      <legend className={showLabel ? 'mb-2 text-sm font-semibold text-foreground' : 'sr-only'}>{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
