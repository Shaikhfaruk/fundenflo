import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ScoreScreen } from '@/components/borrower/score-screen';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('flow.score');
  return { title: t('metaTitle') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ScoreScreen />
    </Suspense>
  );
}
