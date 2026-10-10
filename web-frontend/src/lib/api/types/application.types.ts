import type { PartyRef } from './common.types';

type ApplicationLocation = { stateId: string | null; cityId: string | null; pincode: string | null; city?: { id: string; name: string; state: { gstCode: string; name: string } } | null };

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

export type RequirementInput = { category?: string; purpose?: string | null; purposeNote?: string | null; amountPaise?: number; tenureMonths?: number; cityId?: string; city?: string; pincode?: string };

export type ApplicationParty = {
  id: string;
  party: PartyRef & { displayName: string | null };
  role: string;
  relationship: string | null;
  status: string;
  consentStatus: string;
  consentedAt: string | null;
  mobile: string | null;
  createdAt: string;
};

export type AddPartyInput = { role: string; name: string; mobile: string; countryCode?: string; relationship?: string };

export type ApplicationEvent = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
  actorType: string;
  actorUserId: string | null;
  createdAt: string;
};
