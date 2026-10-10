import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminTabs } from '@/components/admin/admin-tabs';
import { AdminResourceScreen } from '@/components/admin/resource-screen';
import { ResourceKey } from '@/lib/constants/admin-resources.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.resources.attributes');
  return { title: t('title') };
}

export default function Page() {
  return <AdminResourceScreen resource={ResourceKey.Attributes} tabs={<AdminTabs group="attributes" />} />;
}
