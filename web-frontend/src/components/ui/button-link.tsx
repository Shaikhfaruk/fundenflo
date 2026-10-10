import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function ButtonLink({ className, variant, size, ...props }: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
