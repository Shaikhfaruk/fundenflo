import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OpsParty } from '@/components/ops/ops-party';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.party');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OpsParty />
    </Suspense>
  );
}
