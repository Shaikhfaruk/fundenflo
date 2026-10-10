import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LenderInbox } from '@/components/lender/lender-inbox';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lender.inbox');
  return { title: t('title') };
}

export default function LenderHomePage() {
  return <LenderInbox />;
}
