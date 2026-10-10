import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({ label, value, icon: Icon, emphasis }: { label: string; value: number | string; icon: LucideIcon; emphasis?: boolean }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground', emphasis && 'bg-primary/10 text-primary')}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
