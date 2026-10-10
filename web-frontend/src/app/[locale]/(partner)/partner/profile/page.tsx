import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerProfileScreen } from '@/components/partner/partner-profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.profile');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerProfileScreen />;
}
