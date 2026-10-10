import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerClients } from '@/components/partner/partner-clients';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.clients');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerClients />;
}
