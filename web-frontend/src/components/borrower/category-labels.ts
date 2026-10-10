'use client';

import { useQuery } from '@tanstack/react-query';

import { categoriesQuery } from '@/lib/api/catalog';

export function useCategoryLabel() {
  const { data } = useQuery(categoriesQuery());
  const labels = new Map(data?.items.map((category) => [category.key, category.label]) ?? []);
  return (key: string | null) => (key ? (labels.get(key) ?? key.replaceAll(/[-_]/g, ' ')) : '');
}
