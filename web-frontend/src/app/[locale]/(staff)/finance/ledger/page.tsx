import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { FinanceLedger } from '@/components/finance/finance-ledger';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance.ledger');
  return { title: t('title') };
}

export default function Page() {
  return <FinanceLedger />;
}
