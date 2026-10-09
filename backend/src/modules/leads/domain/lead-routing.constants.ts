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

export const ROUTE_JOB = 'route';

export const EXPIRE_OFFER_JOB = 'expire_offer';

export const BULK_ROUTE_MAX = 500;
