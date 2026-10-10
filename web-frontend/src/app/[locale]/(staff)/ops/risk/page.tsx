import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OpsRisk } from '@/components/ops/ops-risk';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.risk');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OpsRisk />
    </Suspense>
  );
}
