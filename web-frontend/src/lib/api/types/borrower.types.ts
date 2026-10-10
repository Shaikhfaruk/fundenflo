import type { PartyRef } from './common.types';

type PanOnRecord = { masked: string; verified: boolean; verifiedAt: string | null };

export type BorrowerProfile = {
  id: string;
  party: PartyRef & { displayName: string | null };
  actingParty: PartyRef & { displayName: string | null };
  segmentKey: string;
  subSegmentKey: string | null;
  incorporatedOn: string | null;
  status: string;
  channel: string;
  partnerOrganizationId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  kyc?: { panHolder: string | null; pan: PanOnRecord | null };
};

export type BorrowerProfilePatch = { subSegment?: string | null; incorporatedOn?: string | null; businessName?: string };

export type PanInput = { pan: string; name?: string; dateOfBirth?: string };

export type PanResult = { pan: string; verified: boolean; nameMatch: boolean; nameOnRecord: string | null; partyId: string; provider: string };
