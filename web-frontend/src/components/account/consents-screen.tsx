'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState } from '@/components/data/empty-state';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { consentKeys, consentTemplateQuery, giveConsents, myConsentsQuery, withdrawConsent } from '@/lib/api/consents';
import type { ConsentState } from '@/lib/api/types/consent.types';
import { ACCOUNT_CONSENT_CONTEXT } from '@/lib/constants/consent.constants';
import { formatRelative } from '@/lib/format/date';
import { StatusTone } from '@/lib/constants/status.constants';

function OptIns({ current }: { current: ConsentState[] }) {
  const t = useTranslations('account.consents');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const template = useQuery(consentTemplateQuery(ACCOUNT_CONSENT_CONTEXT));
  const granted = new Set(current.filter((item) => item.granted).map((item) => item.purpose));
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const save = useMutation({
    mutationFn: () => {
      if (!template.data) throw new Error('No template');
      return giveConsents({ templateVersionId: template.data.versionId, clientRecordedAt: new Date().toISOString(), locale, items: template.data.items.map((item) => ({ purpose: item.purpose, granted: choices[item.purpose] ?? granted.has(item.purpose) })) });
    },
    onSuccess: () => {
      toast.success(t('saved'));
      setChoices({});
      void queryClient.invalidateQueries({ queryKey: consentKeys.all });
    },
  });
  if (!template.data) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('optInsTitle')}</CardTitle>
        <CardDescription>{t('optInsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" translate="no">
        {template.data.items.map((item) => (
          <label key={item.purpose} className="flex items-start gap-3">
            <Switch checked={choices[item.purpose] ?? granted.has(item.purpose)} onCheckedChange={(value) => setChoices((previous) => ({ ...previous, [item.purpose]: value }))} />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-sm text-muted-foreground">{item.details}</span>
            </span>
          </label>
        ))}
        <Button className="self-start" onClick={() => save.mutate()} disabled={save.isPending || Object.keys(choices).length === 0}>
          {t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConsentsScreen() {
  const t = useTranslations('account.consents');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const consents = useQuery(myConsentsQuery());
  const [confirm, setConfirm] = useState<ConsentState | null>(null);
  const withdraw = useMutation({
    mutationFn: (purpose: string) => withdrawConsent(purpose),
    onSuccess: () => {
      toast.success(t('withdrawn'));
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: consentKeys.all });
    },
  });
  if (consents.isPending) return <Skeleton className="h-48 w-full rounded-xl" />;
  const items = consents.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon="shield" body={t('empty')} className="border-none" />
          ) : (
            <ul className="flex flex-col divide-y">
              {items.map((item) => (
                <li key={item.purpose} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" translate="no">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('changed', { when: formatRelative(item.lastChangedAt, locale) })}</p>
                  </div>
                  <StatusBadge status={item.granted ? 'granted' : 'notGranted'} tone={item.granted ? StatusTone.Success : StatusTone.Neutral} namespace="account.consents" />
                  {item.granted ? (
                    <Button variant="outline" size="sm" onClick={() => setConfirm(item)}>
                      {t('withdraw')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <OptIns current={items} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('confirmWithdraw')}
        description={t('confirmWithdrawBody')}
        confirmLabel={t('withdraw')}
        destructive
        pending={withdraw.isPending}
        onConfirm={() => confirm && withdraw.mutate(confirm.purpose)}
      />
    </div>
  );
}
