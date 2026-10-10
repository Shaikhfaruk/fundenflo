import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PartnerTeam } from '@/components/partner/partner-team';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.team');
  return { title: t('metaTitle') };
}

export default function Page() {
  return <PartnerTeam />;
}
