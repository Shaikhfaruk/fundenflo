import { z } from 'zod';

import { PartnerKind, PartnerLevel } from '../../../common/enums/db.enums.js';
import { AssignmentStrategy } from '../../../engines/assignment/assignment.types.js';
import { ROUTING_DEFAULTS } from './lead-routing.constants.js';

const weight = z.number().min(0).max(100);

export const routingRuleContentSchema = z
  .object({
    priority: z.number().int().min(0).max(10_000).default(ROUTING_DEFAULTS.priority),
    when: z.unknown().optional(),
    strategy: z.enum(Object.values(AssignmentStrategy)),
    offers: z.number().int().min(1).max(10).default(ROUTING_DEFAULTS.offers),
    maxOffers: z.number().int().min(1).max(50).default(ROUTING_DEFAULTS.maxOffers),
    pool: z
      .object({
        kinds: z.array(z.enum(Object.values(PartnerKind))).min(1).optional(),
        levels: z.array(z.enum(Object.values(PartnerLevel))).min(1).optional(),
        organizationIds: z.array(z.uuid()).min(1).max(200).optional(),
        requireServiceArea: z.boolean().default(true),
        requireCapabilities: z.boolean().default(true),
        requireLanguage: z.boolean().default(false),
      })
      .strict()
      .default({ requireServiceArea: true, requireCapabilities: true, requireLanguage: false }),
    weights: z.object({ new: weight, active: weight, strategic: weight }).partial().strict().optional(),
    sla: z
      .object({
        acceptHours: z.number().min(0.25).max(168).default(ROUTING_DEFAULTS.acceptHours),
        firstContactHours: z.number().min(0.25).max(336).default(ROUTING_DEFAULTS.firstContactHours),
      })
      .strict()
      .default({ acceptHours: ROUTING_DEFAULTS.acceptHours, firstContactHours: ROUTING_DEFAULTS.firstContactHours }),
  })
  .strict();

export type RoutingRuleContent = z.output<typeof routingRuleContentSchema>;

export type CompiledRoutingRule = RoutingRuleContent;
