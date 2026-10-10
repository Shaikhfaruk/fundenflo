import type { AttributeSpec } from '../../../engines/conditions/condition.types.js';

export const LEAD_ROUTING_ATTRIBUTES: Record<string, AttributeSpec> = {
  'lead.segment': { dataType: 'string' },
  'lead.sub_segment': { dataType: 'string' },
  'lead.category': { dataType: 'string' },
  'lead.purpose': { dataType: 'string' },
  'lead.state': { dataType: 'string' },
  'lead.city_id': { dataType: 'string' },
  'lead.pincode': { dataType: 'string' },
  'lead.amount_paise': { dataType: 'money' },
  'lead.tenure_months': { dataType: 'integer' },
  'lead.source': { dataType: 'string' },
  'lead.campaign': { dataType: 'string' },
  'lead.language': { dataType: 'string' },
  'lead.urgency': { dataType: 'string' },
  'lead.quality_score': { dataType: 'integer' },
  'lead.flags': { dataType: 'string' },
};

export const DEFAULT_LEVEL_WEIGHTS = { new: 1, active: 2, strategic: 3 } as const;

export const ROUTING_DEFAULTS = {
  priority: 100,
  offers: 1,
  maxOffers: 5,
  acceptHours: 4,
  firstContactHours: 24,
} as const;

export const RoutingOutcome = {
  Offered: 'offered',
  ConsentPending: 'consent_pending',
  NotRoutable: 'not_routable',
  AlreadyAssigned: 'already_assigned',
  NoRule: 'no_rule',
  ManualRule: 'manual_rule',
  NoCandidate: 'no_candidate',
  OfferLimitReached: 'offer_limit_reached',
} as const;

export type RoutingOutcome = (typeof RoutingOutcome)[keyof typeof RoutingOutcome];

export const OTHER_REASON = 'other';

export const AssignmentDeclineReason = {
  OutsideServiceArea: 'outside_service_area',
  CategoryNotHandled: 'category_not_handled',
  CapacityFull: 'capacity_full',
  ConflictOfInterest: 'conflict_of_interest',
  Other: OTHER_REASON,
} as const;

export type AssignmentDeclineReason = (typeof AssignmentDeclineReason)[keyof typeof AssignmentDeclineReason];

export const AssignmentReturnReason = {
  Unreachable: 'unreachable',
  NotInterested: 'not_interested',
  NotEligible: 'not_eligible',
  WrongDetails: 'wrong_details',
  CapacityFull: 'capacity_full',
  Other: OTHER_REASON,
} as const;

export type AssignmentReturnReason = (typeof AssignmentReturnReason)[keyof typeof AssignmentReturnReason];

export const AssignmentCloseReason = {
  AcceptDeadlineMissed: 'accept_sla_missed',
  AcceptedByAnotherPartner: 'accepted_by_another_partner',
  ConsentWithdrawn: 'consent_withdrawn',
  LeadStatusChanged: 'lead_status_changed',
  LeadLost: 'lead_lost',
  RevokedByOps: 'revoked_by_ops',
  OfflineConversionVerified: 'offline_conversion_verified',
} as const;

export type AssignmentCloseReason = (typeof AssignmentCloseReason)[keyof typeof AssignmentCloseReason];

export const PartnerInboxView = {
  Offered: 'offered',
  Active: 'active',
  Closed: 'closed',
} as const;

export type PartnerInboxView = (typeof PartnerInboxView)[keyof typeof PartnerInboxView];

export const REFERRAL_STRATEGY = 'referral';

export const ROUTE_JOB = 'route';

export const LeadSlaKind = {
  AssignmentAccept: 'lead_assignment.accept',
  AssignmentFirstContact: 'lead_assignment.first_contact',
} as const;

export type LeadSlaKind = (typeof LeadSlaKind)[keyof typeof LeadSlaKind];

export const LEAD_ASSIGNMENT_SLA_ENTITY = 'lead_assignment';

export const SLA_WARN_AT_RATIO = 0.75;

export const BULK_ROUTE_MAX = 500;
