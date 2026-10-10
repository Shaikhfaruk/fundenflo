import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { FinanceReceivables } from '@/components/finance/finance-receivables';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance.receivables');
  return { title: t('title') };
}

export default function Page() {
  return <FinanceReceivables />;
}
