import { Skeleton } from '@/components/ui/skeleton';

export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
