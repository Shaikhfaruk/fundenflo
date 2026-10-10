import type { ComponentProps } from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function SearchInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className={cn('flex h-11 items-center gap-2.5 rounded-lg border-2 border-transparent bg-field px-3 text-muted-foreground transition-colors focus-within:border-navy focus-within:bg-card focus-within:text-navy', className)}>
      <Icon name="search" size={20} />
      <input type="search" className="h-full w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" {...props} />
    </div>
  );
}
