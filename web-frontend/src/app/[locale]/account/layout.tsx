import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AccountTabs } from '@/components/account/account-tabs';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default async function AccountLayout({ children }: LayoutProps<'/[locale]/account'>) {
  const t = await getTranslations('account');
  return (
    <AppShell area={ShellArea.Account}>
      <div className="flex w-full max-w-4xl flex-col gap-4">
        <PageHeader eyebrow={t('eyebrow')} title={t('title')} />
        <Suspense fallback={<div className="h-11 rounded-xl bg-subtle" />}>
          <AccountTabs />
        </Suspense>
        {children}
      </div>
    </AppShell>
  );
}
