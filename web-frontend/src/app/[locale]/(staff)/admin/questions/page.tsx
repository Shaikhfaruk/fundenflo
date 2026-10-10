import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminResourceScreen } from '@/components/admin/resource-screen';
import { ResourceKey } from '@/lib/constants/admin-resources.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.resources.questions');
  return { title: t('title') };
}

export default function Page() {
  return <AdminResourceScreen resource={ResourceKey.Questions} />;
}
