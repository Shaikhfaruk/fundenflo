'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { applicationKeys, createApplication } from '@/lib/api/applications';
import { categoriesQuery, segmentsQuery } from '@/lib/api/catalog';
import { RoutePath } from '@/lib/constants/routes.constants';
import { formatPaise } from '@/lib/format/money';
import { cn } from '@/lib/utils';

const BPS_PER_PERCENT = 100;
const BUSINESS_SEGMENT = 'msme';

function Choice({ selected, disabled, onSelect, title, description, badge, icon }: { selected: boolean; disabled?: boolean; onSelect: () => void; title: string; description?: string | null; badge?: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn('flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60', selected && 'border-primary bg-primary/5')}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {title}
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </span>
      {selected ? <Check className="size-5 shrink-0 text-primary" /> : null}
    </button>
  );
}

export function StartApplication() {
  const t = useTranslations('borrower.start');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toastError = useErrorToast();
  const [segment, setSegment] = useState<string | null>(null);
  const [subSegment, setSubSegment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [fieldError, setFieldError] = useState<{ path: string; message: string } | null>(null);
  const segments = useQuery(segmentsQuery());
  const chosenSegment = segments.data?.items.find((item) => item.key === segment);
  const needsSubSegment = Boolean(chosenSegment?.subSegments.length);
  const categories = useQuery({ ...categoriesQuery({ segment: segment ?? undefined, subSegment: subSegment ?? undefined }), enabled: Boolean(segment) && (!needsSubSegment || Boolean(subSegment)) });
  const create = useMutation({
    mutationFn: () => createApplication({ segment: segment ?? '', subSegment: subSegment ?? undefined, category: category ?? '', businessName: businessName.trim() || undefined }),
    meta: { handlesError: true },
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(t('created', { ref: application.ref }));
      router.replace(RoutePath.application(application.id));
    },
    onError: (error) => {
      const issue = error instanceof ApiError ? error.fieldIssues[0] : undefined;
      if (issue) setFieldError(issue);
      else toastError(error);
    },
  });
  const reasonText = (reason: string | null | undefined) => (reason && t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason);
  const ready = Boolean(segment && category && (!needsSubSegment || subSegment));
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('title')} description={t('description')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('segment')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {segments.isPending
            ? [0, 1].map((key) => <Skeleton key={key} className="h-20 rounded-xl" />)
            : segments.data?.items.map((item) => (
                <Choice
                  key={item.key}
                  selected={segment === item.key}
                  onSelect={() => {
                    setSegment(item.key);
                    setSubSegment(null);
                    setCategory(null);
                  }}
                  title={item.label}
                  description={item.description}
                  icon={item.key === BUSINESS_SEGMENT ? <Briefcase className="size-5 text-primary" /> : <UserRound className="size-5 text-primary" />}
                />
              ))}
        </CardContent>
      </Card>
      {needsSubSegment ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('subSegment')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {chosenSegment?.subSegments.map((item) => (
              <Choice
                key={item.key}
                selected={subSegment === item.key}
                onSelect={() => {
                  setSubSegment(item.key);
                  setCategory(null);
                }}
                title={item.label}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
      {categories.data ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('category')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {categories.data.items.map((item) => {
              const available = item.availability?.available ?? true;
              return (
                <Choice
                  key={item.key}
                  selected={category === item.key}
                  disabled={!available}
                  onSelect={() => setCategory(item.key)}
                  title={item.label}
                  badge={available ? undefined : t('unavailable')}
                  description={available ? `${t('range', { min: formatPaise(item.minAmountPaise, locale, true), max: formatPaise(item.maxAmountPaise, locale, true) })}${item.illustrativeRateBps ? ` · ${t('rate', { rate: item.illustrativeRateBps / BPS_PER_PERCENT })}` : ''}` : reasonText(item.availability?.reason)}
                />
              );
            })}
          </CardContent>
        </Card>
      ) : categories.isFetching ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : null}
      {segment === BUSINESS_SEGMENT && category ? (
        <Card>
          <CardContent>
            <Field data-invalid={fieldError?.path === 'businessName'}>
              <FieldLabel htmlFor="businessName">{t('businessName')}</FieldLabel>
              <Input id="businessName" autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
              <FieldDescription>{t('businessNameHint')}</FieldDescription>
              {fieldError?.path === 'businessName' ? <FieldError>{fieldError.message}</FieldError> : null}
            </Field>
          </CardContent>
        </Card>
      ) : null}
      {fieldError && fieldError.path !== 'businessName' ? <FieldError>{fieldError.message}</FieldError> : null}
      <Button size="lg" className="self-start" disabled={!ready || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? <Spinner /> : null}
        {create.isPending ? t('creating') : t('create')}
      </Button>
    </div>
  );
}
