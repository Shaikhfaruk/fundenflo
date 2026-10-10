'use client';

import { useQuery } from '@tanstack/react-query';

import { useClientValue } from '@/hooks/use-client-value';
import { meQuery } from '@/lib/api/me';

const onClient = () => true;

export function useMe() {
  const query = useQuery(meQuery());
  const hydrated = useClientValue(onClient);
  return { ...query, data: hydrated ? query.data : undefined, isPending: hydrated ? query.isPending : true };
}

export const initialsOf = (name: string | null | undefined, fallback: string) =>
  (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || fallback.slice(0, 1).toUpperCase();
