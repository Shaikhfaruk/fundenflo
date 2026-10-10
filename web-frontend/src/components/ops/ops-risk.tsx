'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { DetailSheet } from '@/components/data/detail-sheet';
import { KeyValues } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { anyToUndefined, EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { decideFraudReview, fraudReviewQuery, fraudReviewsQuery, opsRiskKeys, riskSignalsQuery } from '@/lib/api/ops-risk';
import type { FraudReview, RiskSignal } from '@/lib/api/types/ops.types';
import { FRAUD_DECISIONS, FRAUD_NOTE_MIN_LENGTH, FRAUD_REVIEW_STATUSES, LEAD_NOTE_MAX_LENGTH, RISK_SEVERITIES, RISK_SIGNAL_KINDS, RISK_SIGNAL_STATUSES } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, SEVERITY_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { textOf } from '@/lib/format/fact';

const Tab = { Reviews: 'reviews', Signals: 'signals' } as const;

const evidenceText = (evidence: Record<string, unknown> | null) =>
  evidence
    ? Object.entries(evidence)
        .map(([key, value]) => `${key}: ${textOf(value)}`)
        .join(' · ')
    : '—';

function ReviewSheet({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const t = useTranslations('ops.risk');
  const kindLabel = useEnumLabel('riskKind');
  const decisionLabel = useEnumLabel('fraudDecision');
  const severityLabel = useEnumLabel('severity');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const review = useQuery(fraudReviewQuery(reviewId));
  const [deciding, setDeciding] = useState(false);
  const decide = useMutation({
    mutationFn: ({ decision, note }: { decision: string; note: string }) => decideFraudReview(reviewId, { decision, note, expectedVersion: review.data?.version ?? 1 }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('decided'));
      setDeciding(false);
      void queryClient.invalidateQueries({ queryKey: opsRiskKeys.all });
      onClose();
    },
    onError: (failure) => errorToast(failure),
  });
  const data = review.data;
  return (
    <DetailSheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={t('reviewTitle')}
      description={data ? t('reviewSubtitle', { severity: severityLabel(data.highestSeverity), when: formatRelative(data.createdAt, locale) }) : undefined}
      footer={data?.status === FRAUD_REVIEW_STATUSES[0] ? <Button onClick={() => setDeciding(true)}>{t('decide')}</Button> : null}
    >
      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <KeyValues
            columns={1}
            items={[
              { label: t('subject'), value: data.applicationId ? <Link href={RoutePath.opsCase(data.applicationId)} className="font-semibold text-gold-ink hover:underline">{t('openCase')}</Link> : data.subject.type },
              { label: t('party'), value: data.partyId ? <Link href={RoutePath.opsParty(data.partyId)} className="font-semibold text-gold-ink hover:underline">{t('openParty')}</Link> : '—' },
              { label: t('decision'), value: data.decision ? `${decisionLabel(data.decision)} · ${data.note ?? ''}` : t('undecided') },
              { label: t('decidedAt'), value: formatDateTime(data.decidedAt, locale) },
            ]}
          />
          <h3 className="text-sm font-semibold text-navy">{t('signals')}</h3>
          <ul className="flex flex-col gap-2">
            {(data.signals ?? []).map((signal) => (
              <li key={signal.id} className="flex flex-col gap-1 rounded-lg bg-subtle/60 p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{kindLabel(signal.kind)}</span>
                  <StatusBadge status={signal.severity} tone={toneOf(SEVERITY_TONE, signal.severity)} namespace="enums.severity" />
                </span>
                <span className="text-xs break-words text-muted-foreground">{evidenceText(signal.evidence)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ReasonDialog
        open={deciding}
        onOpenChange={setDeciding}
        title={t('decideTitle')}
        description={t('decideBody')}
        label={t('decisionNote')}
        confirmLabel={t('decide')}
        pending={decide.isPending}
        minLength={FRAUD_NOTE_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        options={FRAUD_DECISIONS.map((value) => ({ value, label: decisionLabel(value) }))}
        optionsLabel={t('decision')}
        onConfirm={(note, decision) => (decision ? decide.mutate({ decision, note }) : null)}
      />
    </DetailSheet>
  );
}

function Reviews() {
  const t = useTranslations('ops.risk');
  const statusLabel = useEnumLabel('reviewStatus');
  const locale = useLocale();
  const [status, setStatus] = useState<string>(FRAUD_REVIEW_STATUSES[0]);
  const [open, setOpen] = useState<string | null>(null);
  const reviews = useInfiniteQuery(fraudReviewsQuery(anyToUndefined(status)));
  const columns: Column<FraudReview>[] = [
    {
      key: 'subject',
      header: t('subject'),
      cell: (row) =>
        row.applicationId ? (
          <Link href={RoutePath.opsCase(row.applicationId)} className="font-semibold text-navy hover:underline">
            {t('caseSubject')}
          </Link>
        ) : (
          <span className="font-semibold text-navy">{row.subject.type}</span>
        ),
    },
    { key: 'severity', header: t('severity'), cell: (row) => <StatusBadge status={row.highestSeverity} tone={toneOf(SEVERITY_TONE, row.highestSeverity)} namespace="enums.severity" /> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.decision ?? row.status} tone={toneOf(REVIEW_STATUS_TONE, row.decision ?? row.status)} namespace="enums.reviewStatus" /> },
    { key: 'opened', header: t('opened'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
    { key: 'open', header: '', cell: (row) => <Button size="xs" variant="outline" onClick={() => setOpen(row.id)}>{t('review')}</Button>, className: 'text-right' },
  ];
  return (
    <>
      <FilterBar onRefresh={() => void reviews.refetch()} refreshing={reviews.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={FRAUD_REVIEW_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={statusLabel} />
      </FilterBar>
      <PagedList result={reviews} columns={columns} rowKey={(row) => row.id} title={() => <span>{t('reviewTitle')}</span>} empty={<EmptyState icon="shield" title={t('emptyReviewsTitle')} body={t('emptyReviews')} />} />
      {open ? <ReviewSheet key={open} reviewId={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Signals() {
  const t = useTranslations('ops.risk');
  const kindLabel = useEnumLabel('riskKind');
  const severityLabel = useEnumLabel('severity');
  const statusLabel = useEnumLabel('reviewStatus');
  const locale = useLocale();
  const [kind, setKind] = useState('any');
  const [severity, setSeverity] = useState('any');
  const [status, setStatus] = useState<string>(RISK_SIGNAL_STATUSES[0]);
  const signals = useInfiniteQuery(riskSignalsQuery({ kind: anyToUndefined(kind), severity: anyToUndefined(severity), status: anyToUndefined(status) }));
  const columns: Column<RiskSignal>[] = [
    { key: 'kind', header: t('kind'), cell: (row) => <span className="font-semibold text-navy">{kindLabel(row.kind)}</span>, hideOnCard: true },
    { key: 'severity', header: t('severity'), cell: (row) => <StatusBadge status={row.severity} tone={toneOf(SEVERITY_TONE, row.severity)} namespace="enums.severity" /> },
    { key: 'evidence', header: t('evidence'), cell: (row) => <span className="line-clamp-2 text-xs text-muted-foreground">{evidenceText(row.evidence)}</span> },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} namespace="enums.reviewStatus" /> },
    { key: 'raised', header: t('raised'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
  ];
  return (
    <>
      <FilterBar onRefresh={() => void signals.refetch()} refreshing={signals.isFetching}>
        <EnumSelect value={kind} onChange={setKind} values={RISK_SIGNAL_KINDS} label={t('kind')} allLabel={t('allKinds')} labelOf={kindLabel} className="sm:w-56" />
        <EnumSelect value={severity} onChange={setSeverity} values={RISK_SEVERITIES} label={t('severity')} allLabel={t('allSeverities')} labelOf={severityLabel} className="sm:w-40" />
        <EnumSelect value={status} onChange={setStatus} values={RISK_SIGNAL_STATUSES} label={t('status')} allLabel={t('allStatuses')} labelOf={statusLabel} className="sm:w-40" />
      </FilterBar>
      <PagedList result={signals} columns={columns} rowKey={(row) => row.id} title={(row) => <span>{kindLabel(row.kind)}</span>} empty={<EmptyState icon="flag" title={t('emptySignalsTitle')} body={t('emptySignals')} />} />
    </>
  );
}

export function OpsRisk() {
  const t = useTranslations('ops.risk');
  const [tab, setTab] = useState<string>(Tab.Reviews);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList variant="line">
          <TabsTrigger value={Tab.Reviews}>{t('reviews')}</TabsTrigger>
          <TabsTrigger value={Tab.Signals}>{t('allSignals')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === Tab.Reviews ? <Reviews /> : <Signals />}
    </div>
  );
}
