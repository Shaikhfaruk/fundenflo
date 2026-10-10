import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PrivacyScreen } from '@/components/account/privacy-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('privacy') };
}

export default function AccountPrivacyPage() {
  return <PrivacyScreen />;
}
