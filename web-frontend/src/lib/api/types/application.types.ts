import type { PartyRef } from './common.types';

type ApplicationLocation = { stateId: string | null; cityId: string | null; pincode: string | null };

export type Application = {
  id: string;
  ref: string;
  borrowerProfileId: string;
  party: PartyRef;
  actingParty: PartyRef;
  channel: string;
  partnerOrganizationId: string | null;
  leadId: string | null;
  segmentKey: string;
  subSegmentKey: string | null;
  categoryKey: string;
  purposeKey: string | null;
  purposeNote: string | null;
  amountPaise: number | null;
  tenureMonths: number | null;
  location: ApplicationLocation;
  status: string;
  journeyStage: string;
  pinnedVersions: Record<string, unknown>;
  closedAt: string | null;
  closeReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateApplicationInput = { segment: string; subSegment?: string; businessName?: string; category: string };
