import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ConfigDocumentScreen } from '@/components/admin/config-document';
import { ConfigResource } from '@/lib/constants/admin.constants';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.configResources.question_set');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ConfigDocumentScreen resource={ConfigResource.QuestionSet} />
    </Suspense>
  );
}
