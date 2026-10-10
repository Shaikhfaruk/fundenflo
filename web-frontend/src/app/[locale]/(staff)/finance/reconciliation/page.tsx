import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { FinanceReconciliation } from '@/components/finance/finance-reconciliation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('finance.reconciliation');
  return { title: t('title') };
}

export default function Page() {
  return <FinanceReconciliation />;
}
