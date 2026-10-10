import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OpsMatchReviewDetail } from '@/components/ops/ops-match-reviews';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.matchReviews');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OpsMatchReviewDetail />
    </Suspense>
  );
}
