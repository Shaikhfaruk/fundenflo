import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { LenderProductChange } from '@/components/lender/lender-products';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lender.change');
  return { title: t('eyebrow') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LenderProductChange />
    </Suspense>
  );
}
