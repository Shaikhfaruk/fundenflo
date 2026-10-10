import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerLeadNew } from '@/components/partner/partner-lead-new';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.newLead');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerLeadNew />;
}
