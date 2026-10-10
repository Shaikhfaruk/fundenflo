'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { EnumSelect } from '@/components/data/enum-select';
import { FilterBar } from '@/components/data/filter-bar';
import { FollowUpList } from '@/components/leads/follow-up-list';
import { PageHeader } from '@/components/shell/page-header';
import { useEnumLabel } from '@/hooks/use-enum-label';
import { opsFollowUpsQuery, opsLeadKeys, updateFollowUp } from '@/lib/api/leads';
import { LEAD_ENTITY } from '@/lib/constants/lead.constants';
import { FOLLOW_UP_ASSIGNEES, FOLLOW_UP_STATUSES, FollowUpStatus } from '@/lib/constants/ops.constants';
import { RoutePath } from '@/lib/constants/routes.constants';

export function OpsFollowUps() {
  const t = useTranslations('ops.followUps');
  const statusLabel = useEnumLabel('followUpStatus');
  const assigneeLabel = useEnumLabel('assignee');
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>(FollowUpStatus.Open);
  const [assignee, setAssignee] = useState<string>(FOLLOW_UP_ASSIGNEES[0]);
  const followUps = useQuery(opsFollowUpsQuery({ status, assignee }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <FilterBar onRefresh={() => void followUps.refetch()} refreshing={followUps.isFetching}>
        <EnumSelect value={status} onChange={setStatus} values={FOLLOW_UP_STATUSES} label={t('status')} labelOf={statusLabel} />
        <EnumSelect value={assignee} onChange={setAssignee} values={FOLLOW_UP_ASSIGNEES} label={t('assignee')} labelOf={assigneeLabel} className="sm:w-40" />
      </FilterBar>
      <FollowUpList items={followUps.data?.items ?? []} pending={followUps.isPending} leadHref={(item) => (item.entityType === LEAD_ENTITY ? RoutePath.opsLead(item.entityId) : null)} update={updateFollowUp} onUpdated={() => void queryClient.invalidateQueries({ queryKey: opsLeadKeys.all })} />
    </div>
  );
}
