import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ProfileScreen } from '@/components/account/profile-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('profile') };
}

export default function AccountPage() {
  return <ProfileScreen />;
}
