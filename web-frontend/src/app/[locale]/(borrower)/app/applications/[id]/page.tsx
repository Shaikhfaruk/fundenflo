import { Suspense } from 'react';

import { ApplicationOverview } from '@/components/borrower/application-overview';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export default function ApplicationPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ApplicationOverview />
    </Suspense>
  );
}
