'use client';

import { useQuery } from '@tanstack/react-query';

import { adminOptionsQuery } from '@/lib/api/admin';
import { textOf } from '@/lib/format/fact';

export function usePartyNames() {
  const lenders = useQuery(adminOptionsQuery('lenders', 'GET /admin/lenders', {}));
  const partners = useQuery(adminOptionsQuery('partners', 'GET /admin/partners', {}));
  const lenderById = new Map((lenders.data?.items ?? []).map((lender) => [textOf(lender.id), textOf(lender.name)]));
  const lenderByOrganization = new Map((lenders.data?.items ?? []).map((lender) => [textOf(lender.organizationId), textOf(lender.name)]));
  const partnerByOrganization = new Map((partners.data?.items ?? []).map((partner) => [textOf(partner.organizationId), textOf(partner.name)]));
  return {
    lenders: (lenders.data?.items ?? []).map((lender) => ({ id: textOf(lender.id), name: textOf(lender.name) })),
    lender: (id: string | null) => (id ? (lenderById.get(id) ?? lenderByOrganization.get(id) ?? '—') : '—'),
    partner: (organizationId: string | null) => (organizationId ? (partnerByOrganization.get(organizationId) ?? '—') : '—'),
  };
}
