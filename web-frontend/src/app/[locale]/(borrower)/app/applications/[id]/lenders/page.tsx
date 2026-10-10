import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { LendersScreen } from '@/components/borrower/lenders-screen';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('flow.lenders');
  return { title: t('metaTitle') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LendersScreen />
    </Suspense>
  );
}
