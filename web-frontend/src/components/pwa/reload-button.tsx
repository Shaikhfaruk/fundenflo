'use client';

import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export function ReloadButton() {
  const t = useTranslations('common');
  return (
    <Button onClick={() => window.location.reload()}>
      <RotateCw />
      {t('retry')}
    </Button>
  );
}
