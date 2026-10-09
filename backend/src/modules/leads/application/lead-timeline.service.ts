import { Injectable } from '@nestjs/common';

import { actorTypeOf } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import type { LeadEventType, LeadStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';

export type LeadEventDetails = { fromStatus?: LeadStatus; toStatus?: LeadStatus; reason?: string | null; note?: string | null; data?: Record<string, unknown> };

@Injectable()
export class LeadTimeline {
  constructor(
    private readonly leads: LeadRepository,
    private readonly context: RequestContext,
  ) {}

  record(leadId: string, type: LeadEventType, details: LeadEventDetails = {}) {
    const actor = this.context.actor;
    return this.leads.createEvent({
      leadId,
      type,
      fromStatus: details.fromStatus ?? null,
      toStatus: details.toStatus ?? null,
      reason: details.reason ?? null,
      note: details.note ?? null,
      actorType: actorTypeOf(actor),
      actorUserId: actor?.type === 'user' ? actor.userId : null,
      data: (details.data as Prisma.InputJsonValue | undefined) ?? undefined,
    });
  }
}
