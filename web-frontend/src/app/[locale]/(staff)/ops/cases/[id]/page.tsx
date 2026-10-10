import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { OpsCaseDetail } from '@/components/ops/ops-case-detail';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.caseDetail');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <OpsCaseDetail />
    </Suspense>
  );
}
