import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NotificationsScreen } from '@/components/account/notifications-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('notifications') };
}

export default function AccountNotificationsPage() {
  return <NotificationsScreen />;
}
