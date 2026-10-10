import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerSignup } from '@/components/partner/partner-signup';
import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.signup');
  return { title: t('title') };
}

export default function PartnerSignupPage() {
  return (
    <AppShell area={ShellArea.Account}>
      <PartnerSignup />
    </AppShell>
  );
}
