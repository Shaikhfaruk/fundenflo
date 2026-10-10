import { cva, type VariantProps } from 'class-variance-authority';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const iconTileVariants = cva('flex shrink-0 items-center justify-center transition-colors duration-200', {
  variants: {
    tone: {
      subtle: 'bg-subtle text-navy',
      card: 'bg-card text-navy',
      navy: 'bg-navy text-white',
      gold: 'bg-gold text-navy',
      goldSoft: 'bg-gold-soft text-gold-ink',
      success: 'bg-success-soft text-success',
      info: 'bg-info-soft text-info',
      danger: 'bg-error-soft text-destructive',
      muted: 'bg-[#e6ebf1] text-slate',
      glass: 'bg-white/10 text-gold',
    },
    size: {
      sm: 'size-8 rounded-sm',
      md: 'size-10 rounded-md',
      lg: 'size-12 rounded-md',
    },
  },
  defaultVariants: { tone: 'subtle', size: 'md' },
});

const ICON_SIZE = { sm: 18, md: 20, lg: 22 } as const;

export function IconTile({ icon, tone, size = 'md', className }: { icon: IconName; className?: string } & VariantProps<typeof iconTileVariants>) {
  return (
    <span className={cn(iconTileVariants({ tone, size }), className)} aria-hidden="true">
      <Icon name={icon} size={ICON_SIZE[size ?? 'md']} />
    </span>
  );
}
