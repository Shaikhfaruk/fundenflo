import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StartApplication } from '@/components/borrower/start-application';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('borrower.start.partner');
  return { title: t('title') };
}

export default function Page() {
  return <StartApplication />;
}
