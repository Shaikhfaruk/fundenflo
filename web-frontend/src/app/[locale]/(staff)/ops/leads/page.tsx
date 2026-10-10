import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OpsLeads } from '@/components/ops/ops-leads';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.leads');
  return { title: t('title') };
}

export default function OpsLeadsPage() {
  return <OpsLeads />;
}
