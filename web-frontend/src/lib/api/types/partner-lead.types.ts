import type { LeadContact, OfflineConversion } from './lead.types';

type PartnerAssignment = {
  id: string;
  status: string;
  strategy: string | null;
  assigneeMembershipId: string | null;
  offeredAt: string;
  respondBy: string | null;
  acceptedAt: string | null;
  firstContactBy: string | null;
  closedAt: string | null;
  reason: string | null;
};

type PartnerLeadSummary = {
  id: string;
  ref: string;
  status: string;
  name: string | null;
  businessName: string | null;
  segmentKey: string | null;
  subSegmentKey: string | null;
  categoryKey: string | null;
  purposeKey: string | null;
  purposeNote: string | null;
  amount: { minPaise: number | null; maxPaise: number | null; text: string | null };
  tenureMonths: number | null;
  location: { state: { gstCode: string; name: string } | null; city: { id: string; name: string } | null; pincode: string | null };
  urgency: string | null;
  preferredLanguage: string | null;
  preferredContactTime: string | null;
  version: number;
  createdAt: string;
};

export type PartnerLead = { assignment: PartnerAssignment; lead: PartnerLeadSummary };

export type PartnerLeadDetail = PartnerLead & { contacts: LeadContact[]; conversions: OfflineConversion[]; availableActions: string[] };

export type PartnerLeadPatch = Partial<{ urgency: string | null; preferredLanguage: string | null; preferredContactTime: string | null; tenureMonths: number | null; amountMinPaise: number | null; amountMaxPaise: number | null; purpose: string | null; purposeNote: string | null }>;

export type OfflineConversionInput = { lenderName: string; categoryKey?: string; sanctionedAmountPaise: number; disbursedAmountPaise?: number; sanctionedOn: string; disbursedOn?: string; loanAccountRef?: string; note?: string };

export type ReferLeadInput = { mobile: string; countryCode?: string; name?: string; businessName?: string; segment?: string; category?: string; cityId?: string; city?: string; pincode?: string; amountText?: string; requestConsent: boolean; consent?: { templateVersionId: string; items: Array<{ purpose: string; granted: boolean }> } };

export type ReferLeadResult = { lead: { id: string; ref: string; status: string; consentStatus: string }; attribution: { protectedUntil: string }; assigned: boolean; consentRequested: boolean };
