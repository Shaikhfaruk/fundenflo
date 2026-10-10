import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ConfigDocuments } from '@/components/admin/config-documents';
import { ConfigResource } from '@/lib/constants/admin.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.configResources.scoring_model');
  return { title: t('title') };
}

export default function Page() {
  return <ConfigDocuments resource={ConfigResource.ScoringModel} />;
}
