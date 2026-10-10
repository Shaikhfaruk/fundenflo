import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SwitchScreen } from '@/components/account/switch-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.tabs');
  return { title: t('switch') };
}

export default function AccountSwitchPage() {
  return <SwitchScreen />;
}
