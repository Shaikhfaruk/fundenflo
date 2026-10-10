'use client';

import { useQuery } from '@tanstack/react-query';

import { meQuery } from '@/lib/api/me';

export function useMe() {
  return useQuery(meQuery());
}

export const initialsOf = (name: string | null | undefined, fallback: string) =>
  (name ?? fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || fallback.slice(0, 1).toUpperCase();
