type PartnerVerification = {
  status: string;
  recommendedDecision: string | null;
  recommendedByUserId: string | null;
  recommendationNote: string | null;
  recommendedAt: string | null;
  decidedByUserId: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
};

export type PartnerCapacity = { maxOpenLeads: number | null; paused: boolean; workingDays: number[]; workingHours: { start: string; end: string } | null; segments: string[]; categories: string[]; languages: string[]; version: number };

export type ServiceArea = { id: string; type: string; state?: { gstCode: string; name: string }; city?: { id: string; name: string }; pincode?: string };

type KycIdentifier = { type: string; masked: string; verified: boolean; verifiedAt: string | null };

export type PartnerProfile = {
  id: string;
  organizationId: string;
  name: string;
  organizationStatus: string;
  kind: string;
  level: string;
  membershipNumber: string | null;
  firmRegistrationNumber: string | null;
  verification: PartnerVerification;
  kyc: { status: string; verifiedAt: string | null; bank: { accountLast4: string; ifsc: string | null; updatedAt: string | null } | null; pan?: KycIdentifier | null; gstin?: KycIdentifier | null };
  capacity: PartnerCapacity;
  serviceAreas: ServiceArea[];
  signedUpByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PartnerDashboard = {
  leads: { offered: number; active: number; firstContactDue: number };
  followUps: { dueToday: number; overdue: number };
  conversions: { pending: number; wonThisMonth: number };
  referrals: { protected: number };
  at: string;
};

export type ServiceAreaInput = { stateGstCode?: string; cityId?: string; pincode?: string };

export type PartnerSignupInput = { kind: string; firmName: string; membershipNumber?: string; segments?: string[]; categories?: string[]; languages?: string[]; serviceAreas?: ServiceAreaInput[] };

export type PartnerKycInput = { membershipNumber?: string; firmRegistrationNumber?: string; pan?: string; gstin?: string; bankAccount?: { accountNumber: string; ifsc: string; holderName: string } };

export type CapacityInput = { maxOpenLeads?: number | null; paused?: boolean; workingDays?: number[]; workingHours?: { start: string; end: string } | null; segments?: string[]; categories?: string[]; languages?: string[] };

type Organization = { id: string; name: string; type: string; status: string };

export type PartnerMember = { id: string; context: string; role: string; status: string; organization: Organization; version: number; createdAt: string; userId: string; displayName: string | null; approvedAt: string | null };

type PartnerInvitation = { id: string; organization: Organization; context: string; role: string; channel: string; recipient: string; status: string; expiresAt: string; acceptedAt: string | null; createdAt: string };

export type PartnerTeam = { members: PartnerMember[]; invitations: PartnerInvitation[] };

export type ReferralCode = { id: string; code: string; scope: string; membershipId: string | null; status: string; createdAt: string };

export type Referral = { id: string; protectedUntil: string; createdAt: string; lead: { id: string; ref: string; status: string; consentStatus: string; name: string | null } | null };

type PayoutTotals = { count: number; grossPaise: number; tdsPaise: number; netPaise: number };

export type CommissionSummary = { payablePaise: number; byStatus: Record<string, PayoutTotals> };

export type LedgerEntry = { id: string; kind: string; sourceType: string; sourceId: string; memo: string | null; debitPaise: number; creditPaise: number; postedAt: string };

export type PartnerPayout = { id: string; ref: string; status: string; receivable: { id: string; ref: string; status: string }; submissionId: string | null; applicationId: string | null; basePaise: number; grossPaise: number; tdsRateBps: number; tdsPaise: number; netPaise: number; approvedAt: string | null; paidAt: string | null; utr: string | null; reversedAt: string | null; reverseReason: string | null; createdAt: string };

export type CommissionStatement = { month: string; period: { from: string; to: string }; openingPayablePaise: number; closingPayablePaise: number; paid: PayoutTotals; items: PartnerPayout[] };

export type PartnerBorrowerInput = { name: string; mobile: string; countryCode?: string; segment: string; subSegment?: string; businessName?: string };

export type PartnerBorrower = { id: string; party: { id: string; kind: string; displayName: string | null }; actingParty: { id: string; displayName: string | null }; segmentKey: string; subSegmentKey: string | null; personOutcome: string };
