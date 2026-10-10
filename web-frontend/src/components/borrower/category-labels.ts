'use client';

import { useQuery } from '@tanstack/react-query';

import { type IconName, isIconName } from '@/components/ui/icon';
import { categoriesQuery } from '@/lib/api/catalog';

const FALLBACK_ICON: IconName = 'payments';

export function useCategoryLabel() {
  const { data } = useQuery(categoriesQuery());
  const labels = new Map(data?.items.map((category) => [category.key, category.label]) ?? []);
  return (key: string | null) => (key ? (labels.get(key) ?? key.replaceAll(/[-_]/g, ' ')) : '');
}

export function useCategoryIcon() {
  const { data } = useQuery(categoriesQuery());
  const icons = new Map(data?.items.map((category) => [category.key, category.icon]) ?? []);
  return (key: string | null): IconName => {
    const icon = key ? icons.get(key) : null;
    return isIconName(icon) ? icon : FALLBACK_ICON;
  };
}
