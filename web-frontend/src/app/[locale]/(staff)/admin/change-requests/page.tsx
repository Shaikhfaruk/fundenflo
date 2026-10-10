import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ChangeRequests } from '@/components/admin/change-requests';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.changeRequests');
  return { title: t('title') };
}

export default function Page() {
  return <ChangeRequests />;
}
