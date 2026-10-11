'use client';

import { useQuery } from '@tanstack/react-query';

import { useFirmSearch } from '@/hooks/use-firm-search';
import { adminOptionsQuery } from '@/lib/api/admin';
import { OrganizationType } from '@/lib/constants/admin.constants';
import { LenderStatus } from '@/lib/constants/lender.constants';
import { textOf } from '@/lib/format/fact';
import { useMe } from '@/lib/session/use-me';

export type OrganizationOption = { id: string; name: string; type: string };

export function useOrganizationSearch(enabled: boolean) {
  const { data: me } = useMe();
  const lenders = useQuery({ ...adminOptionsQuery('lenders', 'GET /admin/lenders', { status: LenderStatus.Active }), enabled });
  const { query, setQuery, firms, loading } = useFirmSearch(enabled);
  const own = me?.activeContext?.organization;
  const needle = query.toLowerCase();
  const fixed: OrganizationOption[] = [
    ...(own ? [{ id: own.id, name: own.name, type: OrganizationType.FundenFlo }] : []),
    ...(lenders.data?.items ?? []).map((lender) => ({ id: textOf(lender.organizationId), name: textOf(lender.name), type: OrganizationType.Lender })),
  ];
  const organizations = [...fixed.filter((item) => item.name.toLowerCase().includes(needle)), ...firms.map((firm) => ({ id: firm.organizationId, name: firm.name, type: OrganizationType.Partner }))];
  return { organizations, loading: loading || lenders.isFetching, setQuery };
}
