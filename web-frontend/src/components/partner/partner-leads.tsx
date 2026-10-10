'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCategoryLabel } from '@/components/borrower/category-labels';
import { EmptyState } from '@/components/data/empty-state';
import { PagedList } from '@/components/data/paged-list';
import type { Column } from '@/components/data/responsive-list';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/shell/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { Link } from '@/i18n/navigation';
import { partnerInboxQuery } from '@/lib/api/partner-leads';
import type { PartnerLead } from '@/lib/api/types/partner-lead.types';
import { LEAD_DETAIL_STATUSES, PARTNER_INBOX_VIEWS, PartnerInboxView } from '@/lib/constants/partner.constants';
import { AppPath, RoutePath } from '@/lib/constants/routes.constants';
import { REVIEW_STATUS_TONE, toneOf } from '@/lib/constants/status.constants';
import { formatRelative } from '@/lib/format/date';

function LeadName({ row }: { row: PartnerLead }) {
  const name = <span className="truncate font-semibold text-navy">{row.lead.name ?? row.lead.ref}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      {LEAD_DETAIL_STATUSES.includes(row.assignment.status) ? (
        <Link href={RoutePath.partnerLead(row.lead.id)} className="truncate hover:underline">
          {name}
        </Link>
      ) : (
        name
      )}
      <span className="text-xs text-muted-foreground tabular">{row.lead.ref}</span>
    </span>
  );
}

export function PartnerLeads() {
  const t = useTranslations('partner.leads');
  const viewLabel = useEnumLabel('inboxView');
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const [view, setView] = useState<string>(PartnerInboxView.Offered);
  const leads = useInfiniteQuery(partnerInboxQuery(view));
  const deadline = (row: PartnerLead) => {
    if (row.assignment.status === 'offered') return row.assignment.respondBy ? t('respondBy', { when: formatRelative(row.assignment.respondBy, locale) }) : '—';
    if (row.assignment.firstContactBy && view === PartnerInboxView.Active) return t('callBy', { when: formatRelative(row.assignment.firstContactBy, locale) });
    return formatRelative(row.assignment.closedAt ?? row.assignment.acceptedAt ?? row.assignment.offeredAt, locale);
  };
  const columns: Column<PartnerLead>[] = [
    { key: 'name', header: t('borrower'), cell: (row) => <LeadName row={row} />, hideOnCard: true },
    { key: 'business', header: t('business'), cell: (row) => row.lead.businessName ?? '—' },
    { key: 'need', header: t('need'), cell: (row) => [categoryLabel(row.lead.categoryKey), row.lead.amount.text].filter(Boolean).join(' · ') || '—' },
    { key: 'place', header: t('place'), cell: (row) => row.lead.location.city?.name ?? row.lead.location.state?.name ?? '—' },
    { key: 'status', header: t('status'), cell: (row) => <StatusBadge status={row.assignment.status} tone={toneOf(REVIEW_STATUS_TONE, row.assignment.status)} /> },
    { key: 'when', header: t('when'), cell: (row) => <span className="text-muted-foreground">{deadline(row)}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <ButtonLink href={AppPath.PartnerNewLead} size="sm">
            <Icon name="add" size={16} />
            {t('add')}
          </ButtonLink>
        }
      />
      <Tabs value={view} onValueChange={(value) => setView(String(value))}>
        <TabsList variant="line">
          {PARTNER_INBOX_VIEWS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {viewLabel(item)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <PagedList
        result={leads}
        columns={columns}
        rowKey={(row) => row.assignment.id}
        title={(row) => <LeadName row={row} />}
        empty={<EmptyState icon="inbox" title={t(`empty.${view}.title`)} body={t(`empty.${view}.body`)} />}
      />
    </div>
  );
}
