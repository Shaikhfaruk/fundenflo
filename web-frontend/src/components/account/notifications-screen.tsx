'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { notificationKeys, notificationPreferencesQuery, type NotificationPreferences, updateNotificationPreferences } from '@/lib/api/notifications';

const CHANNELS = ['sms', 'email', 'push'] as const;

type Channels = Pick<NotificationPreferences, (typeof CHANNELS)[number]>;

function PreferencesForm({ current }: { current: NotificationPreferences }) {
  const t = useTranslations('account.notifications');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Channels>({ sms: current.sms, email: current.email, push: current.push });
  const dirty = CHANNELS.some((channel) => values[channel] !== current[channel]);
  const valid = CHANNELS.some((channel) => values[channel]);
  const save = useMutation({
    mutationFn: () => updateNotificationPreferences(values, current.version),
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationKeys.preferences, updated);
      toast.success(t('saved'));
    },
  });
  return (
    <div className="flex flex-col gap-4">
      {CHANNELS.map((channel) => (
        <label key={channel} className="flex items-start justify-between gap-4">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t(channel)}</span>
            <span className="text-sm text-muted-foreground">{t(`${channel}Hint`)}</span>
          </span>
          <Switch checked={values[channel]} onCheckedChange={(checked) => setValues((previous) => ({ ...previous, [channel]: checked }))} />
        </label>
      ))}
      {valid ? null : <FieldError>{t('oneRequired')}</FieldError>}
      <Button className="self-start" onClick={() => save.mutate()} disabled={!dirty || !valid || save.isPending}>
        {save.isPending ? <Spinner /> : null}
        {tCommon('save')}
      </Button>
    </div>
  );
}

export function NotificationsScreen() {
  const t = useTranslations('account.notifications');
  const preferences = useQuery(notificationPreferencesQuery());
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>{preferences.data ? <PreferencesForm key={preferences.data.version} current={preferences.data} /> : <Skeleton className="h-40 w-full" />}</CardContent>
    </Card>
  );
}
