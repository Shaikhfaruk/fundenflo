import type { PartyRef } from './common.types';

type LeadAmount = { minPaise: number | null; maxPaise: number | null; text: string | null };

type LeadLocation = { state: { gstCode: string; name: string } | null; city: { id: string; name: string } | null; pincode: string | null; text: string | null };

export type OpsLead = {
  id: string;
  ref: string;
  status: string;
  unqualifiedReason: string | null;
  lostReason: string | null;
  statusNote: string | null;
  statusChangedAt: string;
  holdUntil: string | null;
  party: PartyRef | null;
  business: PartyRef | null;
  source: { id: string; key: string; kind: string };
  campaign: string | null;
  segmentKey: string | null;
  subSegmentKey: string | null;
  categoryKey: string | null;
  amount: LeadAmount;
  location: LeadLocation;
  urgency: string | null;
  preferredLanguage: string | null;
  qualityScore: number | null;
  flags: string[];
  consentStatus: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type OpsLeadFilter = { status?: string; consentStatus?: string; q?: string; cursor?: string; limit?: number };
