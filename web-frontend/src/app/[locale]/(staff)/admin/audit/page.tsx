import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminAudit } from '@/components/admin/admin-audit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.audit');
  return { title: t('title') };
}

export default function Page() {
  return <AdminAudit />;
}
