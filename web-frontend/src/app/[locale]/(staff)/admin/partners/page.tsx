import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminPartners } from '@/components/admin/admin-partners';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.partners');
  return { title: t('title') };
}

export default function Page() {
  return <AdminPartners />;
}
