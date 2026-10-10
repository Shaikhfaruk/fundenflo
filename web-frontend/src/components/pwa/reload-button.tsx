'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export function ReloadButton() {
  const t = useTranslations('common');
  return (
    <Button variant="gold" onClick={() => window.location.reload()}>
      <Icon name="refresh" size={18} />
      {t('retry')}
    </Button>
  );
}
