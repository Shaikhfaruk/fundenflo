import type { PartyRef } from './common.types';
import type { LeadAssignment, LeadEvent } from './ops.types';

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

export type OpsLeadDetail = OpsLead & {
  externalRef: string | null;
  consentEvidence: string | null;
  purposeKey: string | null;
  purposeNote: string | null;
  tenureMonths: number | null;
  preferredContactTime: string | null;
  contacts: LeadContact[];
  assignments: LeadAssignment[];
  events: LeadEvent[];
  convertedApplicationId: string | null;
};

export type OpsLeadPatch = Partial<{ campaign: string | null; urgency: string | null; preferredLanguage: string | null; preferredContactTime: string | null; tenureMonths: number | null; amountMinPaise: number | null; amountMaxPaise: number | null; flags: string[] }>;

export type CreateLeadInput = { name: string; mobile: string; countryCode?: string; businessName?: string; segment?: string; category?: string; amountText?: string; city?: string; campaign?: string; consent?: { basis: string; evidence: string; items: Array<{ purpose: string; granted: boolean }> } };

export type LeadContact = { id?: string; type: string; value?: string | null; masked: string; primary: boolean; verified?: boolean; doNotContact: boolean; invalid: boolean };

export type LeadActivity = { id: string; type: string; outcome: string | null; body: string | null; durationSeconds: number | null; occurredAt: string; actorUserId: string | null; createdAt: string };

export type FollowUp = {
  id: string;
  entityType: string;
  entityId: string;
  dueAt: string;
  overdue: boolean;
  note: string;
  status: string;
  doneAt: string | null;
  outcomeNote: string | null;
  version: number;
  createdAt: string;
  lead?: { id: string; ref: string; status: string; name: string | null };
};

export type OfflineConversion = {
  id: string;
  leadId: string;
  organizationId: string;
  lenderName: string;
  categoryKey: string | null;
  sanctionedAmountPaise: number;
  disbursedAmountPaise: number | null;
  sanctionedOn: string | null;
  disbursedOn: string | null;
  loanAccountRef: string | null;
  note: string | null;
  status: string;
  decisionNote: string | null;
  version: number;
  createdAt: string;
};
