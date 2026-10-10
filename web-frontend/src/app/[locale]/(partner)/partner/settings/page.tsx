import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerSettings } from '@/components/partner/partner-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.settings');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerSettings />;
}
