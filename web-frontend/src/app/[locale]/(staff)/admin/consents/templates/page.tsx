import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminTabs } from '@/components/admin/admin-tabs';
import { ConfigDocuments } from '@/components/admin/config-documents';
import { ConfigResource } from '@/lib/constants/admin.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.configResources.consent_template');
  return { title: t('title') };
}

export default function Page() {
  return <ConfigDocuments resource={ConfigResource.ConsentTemplate} tabs={<AdminTabs group="consents" />} />;
}
