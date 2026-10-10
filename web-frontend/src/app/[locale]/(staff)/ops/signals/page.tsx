import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OpsSignals } from '@/components/ops/ops-signals';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.signals');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OpsSignals />
    </Suspense>
  );
}
