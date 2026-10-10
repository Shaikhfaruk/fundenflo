import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ConsentsScreen } from '@/components/account/consents-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('consents') };
}

export default function AccountConsentsPage() {
  return <ConsentsScreen />;
}
