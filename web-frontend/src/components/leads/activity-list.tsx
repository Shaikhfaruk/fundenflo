'use client';

import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { pagedRows } from '@/components/data/paged-list';
import { Button } from '@/components/ui/button';
import { useEnumLabel } from '@/hooks/use-enum-label';
import type { Page } from '@/lib/api/types/common.types';
import type { LeadActivity } from '@/lib/api/types/lead.types';
import { formatRelative } from '@/lib/format/date';

export function ActivityList({ result }: { result: UseInfiniteQueryResult<InfiniteData<Page<LeadActivity>>> }) {
  const t = useTranslations('leadWork');
  const tCommon = useTranslations('common');
  const typeLabel = useEnumLabel('activityType');
  const outcomeLabel = useEnumLabel('activityOutcome');
  const locale = useLocale();
  const rows = pagedRows(result);
  if (!result.isPending && rows.length === 0) return <p className="text-sm text-muted-foreground">{t('noActivities')}</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {rows.map((activity) => (
          <li key={activity.id} className="flex flex-col border-t border-subtle py-2 first:border-t-0">
            <span className="text-sm font-semibold text-foreground">
              {typeLabel(activity.type)}
              {activity.outcome ? ` · ${outcomeLabel(activity.outcome)}` : ''}
            </span>
            {activity.body ? <span className="text-[13px] text-muted-foreground">{activity.body}</span> : null}
            <span className="text-xs text-muted-foreground">{formatRelative(activity.occurredAt, locale)}</span>
          </li>
        ))}
      </ul>
      {result.hasNextPage ? (
        <Button variant="ghost" size="xs" className="self-start" onClick={() => void result.fetchNextPage()} disabled={result.isFetchingNextPage}>
          {tCommon('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
