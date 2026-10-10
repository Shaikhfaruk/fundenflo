'use client';

import { useQuery } from '@tanstack/react-query';

import { adminOptionsQuery } from '@/lib/api/admin';
import { textOf } from '@/lib/format/fact';

export function useLenderOptions() {
  const lenders = useQuery(adminOptionsQuery('lenders', 'GET /admin/lenders', { status: 'active' }));
  return (lenders.data?.items ?? []).map((lender) => ({ id: textOf(lender.id), name: textOf(lender.name) }));
}
