import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BorrowerHome } from '@/components/borrower/borrower-home';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('borrower.home');
  return { title: t('title') };
}

export default function BorrowerHomePage() {
  return <BorrowerHome />;
}
