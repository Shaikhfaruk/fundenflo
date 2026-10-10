import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerReferrals } from '@/components/partner/partner-referrals';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.referrals');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerReferrals />;
}
