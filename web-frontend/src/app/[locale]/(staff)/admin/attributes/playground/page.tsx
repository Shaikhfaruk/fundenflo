import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminTabs } from '@/components/admin/admin-tabs';
import { ConditionPlayground } from '@/components/admin/condition-playground';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.conditions');
  return { title: t('title') };
}

export default function Page() {
  return <ConditionPlayground tabs={<AdminTabs group="attributes" />} />;
}
