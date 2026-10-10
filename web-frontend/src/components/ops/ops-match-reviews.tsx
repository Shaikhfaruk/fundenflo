'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { PagedList } from '@/components/data/paged-list';
import { ReasonDialog } from '@/components/data/reason-dialog';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { ScreenSkeleton } from '@/components/shell/screen-skeleton';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link, useRouter } from '@/i18n/navigation';
import { matchReviewQuery, matchReviewsQuery, opsPartyKeys, resolveMatchReview } from '@/lib/api/ops-parties';
import type { MatchReview } from '@/lib/api/types/ops.types';
import { LEAD_NOTE_MAX_LENGTH, MATCH_REVIEW_STATUSES, MatchReviewDecision, PARTY_REASON_MIN_LENGTH } from '@/lib/constants/ops.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate, formatRelative } from '@/lib/format/date';

export function OpsMatchReviews() {
  const t = useTranslations('ops.matchReviews');
  const statusLabel = useEnumLabel('reviewStatus');
  const locale = useLocale();
  const [status, setStatus] = useState<string>(MATCH_REVIEW_STATUSES[0]);
  const reviews = useInfiniteQuery(matchReviewsQuery(status));
  const columns: Column<MatchReview>[] = [
    { key: 'party', header: t('party'), cell: (row) => <Link href={RoutePath.opsMatchReview(row.id)} className="font-semibold text-navy hover:underline">{t('candidates', { count: row.candidatePartyIds.length })}</Link>, hideOnCard: true },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.status} tone={toneOf(REVIEW_STATUS_TONE, row.status)} namespace="enums.reviewStatus" /> },
    { key: 'opened', header: t('opened'), cell: (row) => <span className="text-muted-foreground">{formatRelative(row.createdAt, locale)}</span> },
    { key: 'open', header: '', cell: (row) => <Link href={RoutePath.opsMatchReview(row.id)} className="text-xs font-semibold text-gold-deep hover:underline">{t('review')}</Link>, className: 'text-right' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void reviews.refetch()} refreshing={reviews.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={MATCH_REVIEW_STATUSES} label={t('status')} labelOf={statusLabel} />
      </FilterBar>
      <PagedList result={reviews} columns={columns} rowKey={(row) => row.id} title={(row) => <Link href={RoutePath.opsMatchReview(row.id)}>{t('candidates', { count: row.candidatePartyIds.length })}</Link>} empty={<EmptyState icon="swap" title={t('emptyTitle')} body={t('emptyBody')} />} />
    </div>
  );
}

function ReviewView({ review }: { review: MatchReview }) {
  const t = useTranslations('ops.matchReviews');
  const kindLabel = useEnumLabel('partyKind');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorToast = useErrorToast();
  const parties = review.parties ?? [];
  const [survivor, setSurvivor] = useState<string | null>(review.partyId);
  const [decision, setDecision] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: ({ kind, note }: { kind: string; note: string }) =>
      resolveMatchReview(review.id, kind === MatchReviewDecision.Merge ? { decision: kind, survivorPartyId: survivor ?? undefined, mergedPartyId: parties.find((party) => party.id !== survivor)?.id, note } : { decision: kind, note }),
    meta: { handlesError: true },
    onSuccess: () => {
      toast.success(t('resolved'));
      void queryClient.invalidateQueries({ queryKey: opsPartyKeys.all });
      router.push(AppPath.OpsMatchReviews);
    },
    onError: (failure) => errorToast(failure),
  });
  const open = review.status === MATCH_REVIEW_STATUSES[0];
  return (
    <div className="flex flex-col gap-4">
      <Link href={AppPath.OpsMatchReviews} className="flex items-center gap-1 self-start text-sm font-semibold text-navy hover:underline">
        <Icon name="arrow-back" size={16} />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('detailTitle')}
        description={t('detailBody')}
        badge={<StatusBadge status={review.status} tone={toneOf(REVIEW_STATUS_TONE, review.status)} namespace="enums.reviewStatus" />}
        actions={
          open ? (
            <>
              <Button size="sm" onClick={() => setDecision(MatchReviewDecision.Merge)} disabled={parties.length < 2 || !survivor}>
                {t('merge')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision(MatchReviewDecision.Dismiss)}>
                {t('dismiss')}
              </Button>
            </>
          ) : null
        }
      />
      <Section title={t('keep')}>
        <div className="grid gap-3 md:grid-cols-2">
          {parties.map((party) => (
            <div key={party.id} className="flex flex-col gap-2">
              <ChoiceRow selected={survivor === party.id} onSelect={() => setSurvivor(party.id)} disabled={!open} icon={party.kind === 'business' ? 'business' : 'person'} title={party.displayName ?? t('unnamed')} description={`${kindLabel(party.kind)} · ${t('since', { date: formatDate(party.createdAt, locale) })}${party.hasLogin ? ` · ${t('hasLogin')}` : ''}`} />
              <ul className="flex flex-col gap-1 px-2 text-xs text-muted-foreground">
                {[...party.contacts.map((contact) => `${contact.type}: ${contact.masked}${contact.verified ? ' ✓' : ''}`), ...party.identifiers.map((identifier) => `${identifier.type}: ${identifier.masked}${identifier.verified ? ' ✓' : ''}`)].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link href={RoutePath.opsParty(party.id)} className="px-2 text-xs font-semibold text-gold-deep hover:underline">
                {t('openParty')}
              </Link>
            </div>
          ))}
        </div>
      </Section>
      <ReasonDialog
        key={decision ?? 'none'}
        open={decision !== null}
        onOpenChange={(next) => (next ? null : setDecision(null))}
        title={decision === MatchReviewDecision.Merge ? t('mergeTitle') : t('dismissTitle')}
        description={decision === MatchReviewDecision.Merge ? t('mergeBody') : undefined}
        label={t('note')}
        confirmLabel={decision === MatchReviewDecision.Merge ? t('merge') : t('dismiss')}
        pending={resolve.isPending}
        minLength={PARTY_REASON_MIN_LENGTH}
        maxLength={LEAD_NOTE_MAX_LENGTH}
        onConfirm={(note) => (decision ? resolve.mutate({ kind: decision, note }) : null)}
      />
    </div>
  );
}

export function OpsMatchReviewDetail() {
  const t = useTranslations('ops.matchReviews');
  const { id } = useParams<{ id: string }>();
  const review = useQuery(matchReviewQuery(id));
  if (review.isPending) return <ScreenSkeleton />;
  if (!review.data) return <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">{t('unavailable')}</p>;
  return <ReviewView review={review.data} />;
}
