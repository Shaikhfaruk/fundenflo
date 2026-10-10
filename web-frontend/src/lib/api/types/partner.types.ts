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

type PartnerCapacity = { maxOpenLeads: number | null; paused: boolean; workingDays: string[]; workingHours: unknown; segments: string[]; categories: string[]; languages: string[]; version: number };

type ServiceArea = { id: string; type: string; state?: { gstCode: string; name: string }; city?: { id: string; name: string }; pincode?: string };

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

type ServiceAreaInput = { stateGstCode?: string; cityId?: string; pincode?: string };

export type PartnerSignupInput = { kind: string; firmName: string; membershipNumber?: string; segments?: string[]; categories?: string[]; languages?: string[]; serviceAreas?: ServiceAreaInput[] };
