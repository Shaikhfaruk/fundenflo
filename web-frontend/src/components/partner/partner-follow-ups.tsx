'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { FollowUpList } from '@/components/leads/follow-up-list';
import { PageHeader } from '@/components/shell/page-header';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { usePartnerOwner } from '@/hooks/use-partner-owner';
import { partnerFollowUpsQuery, partnerLeadKeys, updatePartnerFollowUp } from '@/lib/api/partner-leads';
import { partnerKeys } from '@/lib/api/partners';
import { LEAD_ENTITY } from '@/lib/constants/lead.constants';
import { FOLLOW_UP_STATUSES, FollowUpStatus } from '@/lib/constants/ops.constants';
import { PARTNER_FOLLOW_UP_ASSIGNEES } from '@/lib/constants/partner.constants';
import { RoutePath } from '@/lib/constants/routes.constants';

export function PartnerFollowUps() {
  const t = useTranslations('partner.followUps');
  const statusLabel = useEnumLabel('followUpStatus');
  const assigneeLabel = useEnumLabel('assignee');
  const queryClient = useQueryClient();
  const { owner } = usePartnerOwner();
  const [status, setStatus] = useState<string>(FollowUpStatus.Open);
  const [assignee, setAssignee] = useState<string>(PARTNER_FOLLOW_UP_ASSIGNEES[0]);
  const followUps = useQuery(partnerFollowUpsQuery({ status, assignee }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void followUps.refetch()} refreshing={followUps.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={FOLLOW_UP_STATUSES} label={t('status')} labelOf={statusLabel} />
        {owner ? <EnumSelect value={assignee} onChange={setAssignee} values={PARTNER_FOLLOW_UP_ASSIGNEES} label={t('assignee')} labelOf={assigneeLabel} className="sm:w-40" /> : null}
      </FilterBar>
      <FollowUpList
        items={followUps.data?.items ?? []}
        pending={followUps.isPending}
        leadHref={(item) => (item.entityType === LEAD_ENTITY ? RoutePath.partnerLead(item.entityId) : null)}
        update={updatePartnerFollowUp}
        onUpdated={() => {
          void queryClient.invalidateQueries({ queryKey: partnerLeadKeys.all });
          void queryClient.invalidateQueries({ queryKey: partnerKeys.dashboard() });
        }}
      />
    </div>
  );
}
