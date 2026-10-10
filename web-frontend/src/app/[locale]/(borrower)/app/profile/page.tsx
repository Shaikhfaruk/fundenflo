import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BorrowerProfileScreen } from '@/components/borrower/borrower-profile-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('borrower.profile');
  return { title: t('title') };
}

export default function BorrowerProfilePage() {
  return <BorrowerProfileScreen />;
}
