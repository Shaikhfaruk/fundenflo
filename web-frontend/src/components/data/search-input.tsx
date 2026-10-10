import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function SearchInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className={cn('flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:h-9 dark:bg-input/30', className)}>
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input type="search" className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm" {...props} />
    </div>
  );
}
