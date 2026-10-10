'use client';

import { Role } from '@/lib/constants/auth.constants';
import { useMe } from '@/lib/session/use-me';

export function usePartnerOwner() {
  const { data } = useMe();
  return { owner: data?.activeContext?.role === Role.PartnerOwner, membershipId: data?.activeContext?.membershipId ?? null };
}
