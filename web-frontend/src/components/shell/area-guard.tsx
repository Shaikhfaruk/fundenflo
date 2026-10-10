'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/data/empty-state';
import { ButtonLink } from '@/components/ui/button-link';
import type { MeView } from '@/lib/api/types/auth.types';
import { AREA_CONTEXT, ShellArea } from '@/lib/constants/navigation.constants';
import { AppPath } from '@/lib/constants/routes.constants';

export function AreaGuard({ area, me, loading, children }: { area: ShellArea; me: MeView | undefined; loading: boolean; children: ReactNode }) {
  const t = useTranslations('shell.wrongArea');
  const tContexts = useTranslations('contexts');
  if (area === ShellArea.Account) return children;
  if (loading || !me) return children;
  const current = me.activeContext?.context ?? 'none';
  if (current === AREA_CONTEXT[area]) return children;
  return (
    <EmptyState
      icon="shield"
      title={t('title')}
      body={t('body', { context: tContexts.has(current) ? tContexts(current) : current })}
      action={<ButtonLink href={AppPath.AccountSwitch}>{t('switch')}</ButtonLink>}
    />
  );
}
