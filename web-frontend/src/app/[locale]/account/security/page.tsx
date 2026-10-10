import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SecurityScreen } from '@/components/account/security-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('security') };
}

export default function AccountSecurityPage() {
  return <SecurityScreen />;
}
