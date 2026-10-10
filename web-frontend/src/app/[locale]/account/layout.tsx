import { getTranslations } from 'next-intl/server';

import { AccountTabs } from '@/components/account/account-tabs';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default async function AccountLayout({ children }: LayoutProps<'/[locale]/account'>) {
  const t = await getTranslations('account');
  return (
    <AppShell area={ShellArea.Account}>
      <PageHeader title={t('title')} />
      <AccountTabs />
      {children}
    </AppShell>
  );
}
