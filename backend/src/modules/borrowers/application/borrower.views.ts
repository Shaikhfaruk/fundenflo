import type { BorrowerProfileRow } from '../infrastructure/borrower-profile.repository.js';

export const toBorrowerProfileView = (profile: BorrowerProfileRow) => ({
  id: profile.id,
  party: profile.party,
  actingParty: profile.actingParty,
  segmentKey: profile.segmentKey,
  subSegmentKey: profile.subSegmentKey,
  incorporatedOn: profile.incorporatedOn?.toISOString().slice(0, 10) ?? null,
  status: profile.status,
  channel: profile.partnerOrganizationId ? 'partner' : 'direct',
  partnerOrganizationId: profile.partnerOrganizationId,
  version: profile.version,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export type BorrowerProfileView = ReturnType<typeof toBorrowerProfileView>;
