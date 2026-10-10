'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export function FilterBar({ children, onRefresh, refreshing }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#eef2f6] bg-card p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
      {children}
      {onRefresh ? (
        <Button variant="secondary" size="icon-lg" className="hidden shrink-0 rounded-lg sm:ml-auto sm:flex" aria-label={t('refresh')} onClick={onRefresh} disabled={refreshing}>
          <Icon name="refresh" size={20} className={refreshing ? 'animate-spin' : undefined} />
        </Button>
      ) : null}
    </div>
  );
}
