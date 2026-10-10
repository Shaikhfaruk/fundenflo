import { Injectable } from '@nestjs/common';

import { actorTypeOf } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import type { ApplicationEventType, ApplicationStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ApplicationRepository } from '../infrastructure/application.repository.js';

export type ApplicationEventDetails = { fromStatus?: ApplicationStatus; toStatus?: ApplicationStatus; reason?: string | null; note?: string | null; data?: Record<string, unknown> };

@Injectable()
export class ApplicationTimeline {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly context: RequestContext,
  ) {}

  record(applicationId: string, type: ApplicationEventType, details: ApplicationEventDetails = {}) {
    const actor = this.context.actor;
    return this.applications.createEvent({
      applicationId,
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
