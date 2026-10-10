import { Skeleton } from '@/components/ui/skeleton';

export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
