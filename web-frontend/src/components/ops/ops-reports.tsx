'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { Section } from '@/components/data/detail-section';
import { EmptyState } from '@/components/data/empty-state';
import { EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { ResponsiveList } from '@/components/data/responsive-list';
import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { funnelReportQuery, partnerPerformanceQuery } from '@/lib/api/leads';
import type { PartnerPerformance } from '@/lib/api/types/ops.types';
import { Duration, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';
import { FUNNEL_GROUPS, REPORT_DAYS } from '@/lib/constants/ops.constants';
import { formatPaise } from '@/lib/format/money';

const PERCENT = 100;

const STATUS_COLOURS: Record<string, string> = {
  new: 'bg-info',
  qualified: 'bg-navy',
  in_progress: 'bg-[#3d5a80]',
  on_hold: 'bg-gold',
  converted: 'bg-gold-deep',
  won: 'bg-success',
  lost: 'bg-destructive',
  unqualified: 'bg-slate',
};

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * PERCENT)}%`);

const minutes = (value: number | null) => (value === null ? '—' : `${Math.round(value)}m`);

export function OpsReports() {
  const t = useTranslations('ops.reports');
  const tStatus = useTranslations('status');
  const groupLabel = useEnumLabel('funnelGroup');
  const locale = useLocale();
  const categoryLabel = useCategoryLabel();
  const [groupBy, setGroupBy] = useState<string>(FUNNEL_GROUPS[0]);
  const funnel = useQuery(funnelReportQuery(groupBy));
  const performance = useQuery(partnerPerformanceQuery());
  const total = funnel.data?.total ?? 0;
  const won = (funnel.data?.items ?? []).reduce((sum, item) => sum + (item.byStatus.won ?? 0), 0);
  const converted = (funnel.data?.items ?? []).reduce((sum, item) => sum + (item.byStatus.converted ?? 0) + (item.byStatus.won ?? 0), 0);
  const consented = (funnel.data?.items ?? []).reduce((sum, item) => sum + (item.byConsent.ok ?? 0), 0);
  const labelOf = (key: string | null, label: string | null) => (groupBy === 'category' ? categoryLabel(key) || label : label) ?? key ?? t('unknown');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description', { days: REPORT_DAYS })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('leads')} value={total} icon="group" />
        <StatCard label={t('consented')} value={consented} icon="shield" />
        <StatCard label={t('converted')} value={converted} icon="trending-up" />
        <StatCard label={t('won')} value={won} icon="trophy" />
      </div>
      <FilterBar onRefresh={() => void funnel.refetch()} refreshing={funnel.isFetching}>
        <EnumSelect value={groupBy} onChange={setGroupBy} values={FUNNEL_GROUPS} label={t('groupBy')} labelOf={groupLabel} />
      </FilterBar>
      <Section title={t('funnel')}>
        {funnel.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (funnel.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noLeads')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(funnel.data?.items ?? []).map((item, index) => (
              <motion.li key={item.key ?? `none-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * STAGGER_STEP, duration: Duration.Base, ease: EASE_OUT }} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold text-foreground">{labelOf(item.key, item.label)}</span>
                  <span className="text-muted-foreground tabular">{item.total}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                  {Object.entries(item.byStatus).map(([status, count]) => (
                    <span key={status} className={STATUS_COLOURS[status] ?? 'bg-border'} style={{ width: `${(count / Math.max(1, item.total)) * PERCENT}%` }} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{Object.entries(item.byStatus).map(([status, count]) => `${tStatus.has(status) ? tStatus(status) : status} ${count}`).join(' · ')}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('partners')} delay={0.06}>
        {performance.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ResponsiveList<PartnerPerformance['items'][number]>
            rows={performance.data?.items ?? []}
            rowKey={(row) => row.organization.id}
            title={(row) => row.organization.name}
            columns={[
              { key: 'firm', header: t('firm'), cell: (row) => <span className="font-semibold text-navy">{row.organization.name}</span>, hideOnCard: true },
              { key: 'offers', header: t('offers'), cell: (row) => <span className="tabular">{row.offers}</span>, className: 'text-right' },
              { key: 'accept', header: t('acceptRate'), cell: (row) => <span className="tabular">{percent(row.acceptRate)}</span>, className: 'text-right' },
              { key: 'speed', header: t('medianAccept'), cell: (row) => <span className="tabular">{minutes(row.medianAcceptMinutes)}</span>, className: 'text-right' },
              { key: 'contact', header: t('onTime'), cell: (row) => <span className="tabular">{percent(row.firstContactOnTimeRate)}</span>, className: 'text-right' },
              { key: 'conversions', header: t('conversions'), cell: (row) => <span className="tabular">{row.conversionsVerified}</span>, className: 'text-right' },
              { key: 'disbursed', header: t('disbursed'), cell: (row) => <span className="tabular">{formatPaise(row.disbursedAmountPaise, locale, true)}</span>, className: 'text-right' },
            ]}
            empty={<EmptyState icon="handshake" title={t('noPartnersTitle')} body={t('noPartners')} />}
          />
        )}
      </Section>
    </div>
  );
}
