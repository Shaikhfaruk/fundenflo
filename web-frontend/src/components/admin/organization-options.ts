'use client';

import { useQuery } from '@tanstack/react-query';

import { adminOptionsQuery } from '@/lib/api/admin';
import { OrganizationType } from '@/lib/constants/admin.constants';
import { textOf } from '@/lib/format/fact';
import { useMe } from '@/lib/session/use-me';

export type OrganizationOption = { id: string; name: string; type: string };

export function useOrganizationOptions(enabled: boolean): OrganizationOption[] {
  const { data: me } = useMe();
  const lenders = useQuery({ ...adminOptionsQuery('lenders', 'GET /admin/lenders', { status: 'active' }), enabled });
  const partners = useQuery({ ...adminOptionsQuery('partners', 'GET /admin/partners', { verificationStatus: 'verified' }), enabled });
  const own = me?.activeContext?.organization;
  return [
    ...(own ? [{ id: own.id, name: own.name, type: OrganizationType.FundenFlo }] : []),
    ...(lenders.data?.items ?? []).map((lender) => ({ id: textOf(lender.organizationId), name: textOf(lender.name), type: OrganizationType.Lender })),
    ...(partners.data?.items ?? []).map((partner) => ({ id: textOf(partner.organizationId), name: textOf(partner.name), type: OrganizationType.Partner })),
  ];
}
