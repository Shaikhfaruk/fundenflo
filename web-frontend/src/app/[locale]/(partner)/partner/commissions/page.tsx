import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerCommissions } from '@/components/partner/partner-commissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.commissions');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerCommissions />;
}
