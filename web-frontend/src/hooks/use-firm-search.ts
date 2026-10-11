'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { assignableFirmsQuery } from '@/lib/api/leads';
import { MIN_SEARCH_LENGTH } from '@/lib/constants/lead.constants';

export function useFirmSearch(enabled: boolean) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const firms = useQuery({ ...assignableFirmsQuery(debounced.length >= MIN_SEARCH_LENGTH ? debounced : undefined), enabled });
  return { query, setQuery, firms: firms.data?.items ?? [], loading: firms.isFetching };
}
