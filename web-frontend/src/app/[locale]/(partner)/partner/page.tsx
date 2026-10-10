import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerDashboard } from '@/components/partner/partner-dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.dashboard');
  return { title: t('title') };
}

export default function PartnerHomePage() {
  return <PartnerDashboard />;
}
