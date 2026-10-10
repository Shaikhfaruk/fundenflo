import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminInvitations } from '@/components/admin/admin-invitations';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.invitations');
  return { title: t('title') };
}

export default function Page() {
  return <AdminInvitations />;
}
