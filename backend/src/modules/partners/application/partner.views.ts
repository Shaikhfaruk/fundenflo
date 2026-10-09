import type { PartnerWithDetails } from '../infrastructure/partner.repository.js';
import { ServiceAreaType } from '../domain/partner.constants.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

type AreaRow = PartnerWithDetails['serviceAreas'][number];

export const toServiceAreaView = (area: AreaRow) => {
  if (area.state) return { id: area.id, type: ServiceAreaType.State, state: area.state };
  if (area.city) return { id: area.id, type: ServiceAreaType.City, city: area.city };
  return { id: area.id, type: ServiceAreaType.Pincode, pincode: area.pincode };
};

export const toCapacityView = (partner: PartnerWithDetails) => ({
  maxOpenLeads: partner.maxOpenLeads,
  paused: partner.paused,
  workingDays: partner.workingDays,
  workingHours: partner.workingHoursStart && partner.workingHoursEnd ? { start: partner.workingHoursStart, end: partner.workingHoursEnd } : null,
  segments: partner.segments,
  categories: partner.categories,
  languages: partner.languages,
  version: partner.version,
});

export const toPartnerView = (partner: PartnerWithDetails) => ({
  id: partner.id,
  organizationId: partner.organizationId,
  name: partner.organization.name,
  organizationStatus: partner.organization.status,
  kind: partner.kind,
  level: partner.level,
  membershipNumber: partner.membershipNumber,
  firmRegistrationNumber: partner.firmRegistrationNumber,
  verification: {
    status: partner.verificationStatus,
    recommendedDecision: partner.recommendedDecision,
    recommendedByUserId: partner.recommendedByUserId,
    recommendationNote: partner.recommendationNote,
    recommendedAt: iso(partner.recommendedAt),
    decidedByUserId: partner.decidedByUserId,
    decisionNote: partner.decisionNote,
    decidedAt: iso(partner.decidedAt),
  },
  capacity: toCapacityView(partner),
  serviceAreas: partner.serviceAreas.map(toServiceAreaView),
  signedUpByUserId: partner.signedUpByUserId,
  version: partner.version,
  createdAt: partner.createdAt.toISOString(),
  updatedAt: partner.updatedAt.toISOString(),
});
