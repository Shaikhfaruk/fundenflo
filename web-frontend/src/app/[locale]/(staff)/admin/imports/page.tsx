import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminImports } from '@/components/admin/admin-imports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.imports');
  return { title: t('title') };
}

export default function Page() {
  return <AdminImports />;
}
