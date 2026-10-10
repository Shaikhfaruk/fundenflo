'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { referralsQuery } from '@/lib/api/partner-leads';
import { referralCodesQuery } from '@/lib/api/partners';
import type { Referral } from '@/lib/api/types/partner.types';
import { AppPath } from '@/lib/constants/routes.constants';
import { LEAD_CONSENT_TONE, LEAD_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatDate } from '@/lib/format/date';

export function PartnerReferrals() {
  const t = useTranslations('partner.referrals');
  const scopeLabel = useEnumLabel('referralScope');
  const locale = useLocale();
  const codes = useQuery(referralCodesQuery());
  const referrals = useInfiniteQuery(referralsQuery());
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('copied', { code }));
    } catch {
      toast.error(t('copyFailed'));
    }
  };
  const columns: Column<Referral>[] = [
    { key: 'name', header: t('borrower'), cell: (row) => <span className="flex min-w-0 flex-col"><span className="truncate font-semibold text-navy">{row.lead?.name ?? '—'}</span><span className="text-xs text-muted-foreground tabular">{row.lead?.ref}</span></span>, hideOnCard: true },
    { key: 'status', header: t('status'), cell: (row) => (row.lead ? <StatusBadge status={row.lead.status} tone={toneOf(LEAD_STATUS_TONE, row.lead.status)} /> : '—') },
    { key: 'consent', header: t('consent'), cell: (row) => (row.lead ? <StatusBadge status={row.lead.consentStatus} tone={toneOf(LEAD_CONSENT_TONE, row.lead.consentStatus)} /> : '—') },
    { key: 'protected', header: t('protectedUntil'), cell: (row) => <span className="tabular">{formatDate(row.protectedUntil, locale)}</span> },
    { key: 'created', header: t('referred'), cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt, locale)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <ButtonLink href={AppPath.PartnerNewLead} size="sm">
              <Icon name="add" size={16} />
              {t('refer')}
            </ButtonLink>
            <ButtonLink href={AppPath.PartnerNewDispute} size="sm" variant="outline">
              {t('claim')}
            </ButtonLink>
          </>
        }
      />
      <Section title={t('codes')}>
        {codes.isPending ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : codes.data?.available === false || (codes.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noCodes')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {codes.data?.items.map((code) => (
              <li key={code.id} className="flex items-center justify-between gap-2 rounded-lg border border-subtle p-3">
                <span className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{scopeLabel(code.scope)}</span>
                  <span className="font-heading text-lg font-semibold tracking-[0.08em] text-navy select-all">{code.code}</span>
                </span>
                <Button size="xs" variant="outline" onClick={() => void copy(code.code)} aria-label={t('copy', { code: code.code })}>
                  <Icon name="copy" size={14} />
                  {t('copyShort')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('codesHint')}</p>
      </Section>
      <PagedList result={referrals} columns={columns} rowKey={(row) => row.id} title={(row) => <span className="flex flex-col"><span className="font-semibold text-navy">{row.lead?.name ?? '—'}</span><span className="text-xs text-muted-foreground tabular">{row.lead?.ref}</span></span>} empty={<EmptyState icon="group" title={t('emptyTitle')} body={t('emptyBody')} />} />
    </div>
  );
}
