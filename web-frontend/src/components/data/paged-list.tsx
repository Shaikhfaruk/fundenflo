'use client';

import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/data/empty-state';
import { type Column, ResponsiveList } from '@/components/data/responsive-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorText } from '@/hooks/use-error-toast';
import type { Page } from '@/lib/api/types/common.types';

type Props<T> = {
  result: UseInfiniteQueryResult<InfiniteData<Page<T>>>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  title: (row: T) => ReactNode;
  empty: ReactNode;
};

export const pagedRows = <T,>(result: { data?: InfiniteData<Page<T>> }) => result.data?.pages.flatMap((page) => page.items) ?? [];

export function PagedList<T>({ result, columns, rowKey, title, empty }: Props<T>) {
  const t = useTranslations('common');
  const errorText = useErrorText();
  if (result.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (result.isError) return <EmptyState icon="error" title={t('loadFailed')} body={errorText(result.error)} action={<Button variant="outline" size="sm" onClick={() => void result.refetch()}>{t('retry')}</Button>} />;
  return (
    <>
      <ResponsiveList rows={pagedRows(result)} columns={columns} rowKey={rowKey} title={title} empty={empty} />
      {result.hasNextPage ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => void result.fetchNextPage()} disabled={result.isFetchingNextPage}>
          {t('loadMore')}
        </Button>
      ) : null}
    </>
  );
}
