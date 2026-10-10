import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { FinancePayouts } from '@/components/finance/finance-payouts';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance.payouts');
  return { title: t('title') };
}

export default function Page() {
  return <FinancePayouts />;
}
