import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ImproveScreen } from '@/components/borrower/improve-screen';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('flow.improve');
  return { title: t('metaTitle') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ImproveScreen />
    </Suspense>
  );
}
