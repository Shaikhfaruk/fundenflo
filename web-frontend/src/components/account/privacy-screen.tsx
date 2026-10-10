'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/api-error';
import { createDataRequest, dataExportUrl, DataRequestKind, myDataRequestsQuery, privacyKeys } from '@/lib/api/privacy';
import { DATA_REQUEST_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';

const KINDS = Object.values(DataRequestKind);

function NewRequest() {
  const t = useTranslations('account.privacy');
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<DataRequestKind>(DataRequestKind.Access);
  const [details, setDetails] = useState('');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createDataRequest({ kind, details: details.trim() || undefined }),
    meta: { handlesError: true },
    onSuccess: (request) => {
      toast.success(t('created', { ref: request.ref }));
      setDetails('');
      setDetailsError(null);
      void queryClient.invalidateQueries({ queryKey: privacyKeys.mine });
    },
    onError: (error) => {
      const issue = error instanceof ApiError ? error.fieldIssues.find((item) => item.path === 'details') : undefined;
      if (issue) setDetailsError(issue.message);
      else toast.error(error.message);
    },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <RadioGroup value={kind} onValueChange={(value) => setKind(value as DataRequestKind)} className="grid gap-2">
        {KINDS.map((value) => (
          <label key={value} className="flex items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary/40 has-data-checked:bg-primary/5">
            <RadioGroupItem value={value} />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t(`kind.${value}`)}</span>
              <span className="text-sm text-muted-foreground">{t(`kindHint.${value}`)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <Field data-invalid={Boolean(detailsError)}>
        <FieldLabel htmlFor="details">{t('details')}</FieldLabel>
        <Textarea id="details" value={details} onChange={(event) => setDetails(event.target.value)} rows={3} />
        <FieldDescription>{t('detailsHint')}</FieldDescription>
        {detailsError ? <FieldError>{detailsError}</FieldError> : null}
      </Field>
      <Button type="submit" className="self-start" disabled={create.isPending}>
        {create.isPending ? <Spinner /> : null}
        {t('submit')}
      </Button>
    </form>
  );
}

export function PrivacyScreen() {
  const t = useTranslations('account.privacy');
  const locale = useLocale();
  const requests = useQuery(myDataRequestsQuery());
  const download = useMutation({
    mutationFn: dataExportUrl,
    onSuccess: (link) => {
      window.location.assign(link.url);
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t('newRequest')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <NewRequest />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : requests.data?.items.length ? (
            <ul className="flex flex-col divide-y">
              {requests.data.items.map((request) => (
                <li key={request.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium tabular">{request.ref}</span>
                    <span className="text-sm text-muted-foreground">{t(`kind.${request.kind}`)}</span>
                    <StatusBadge status={request.status} tone={toneOf(DATA_REQUEST_STATUS_TONE, request.status)} />
                    <span className="ml-auto text-xs text-muted-foreground">{t('due', { date: formatDate(request.dueAt, locale) })}</span>
                  </div>
                  {request.response ? <p className="text-sm text-muted-foreground">{request.response}</p> : null}
                  {request.rejectedReason ? <p className="text-sm text-destructive">{request.rejectedReason}</p> : null}
                  {request.exportReady ? (
                    <Button variant="outline" size="sm" className="self-start" onClick={() => download.mutate(request.id)} disabled={download.isPending}>
                      <Download />
                      {t('download')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyDescription>{t('empty')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
