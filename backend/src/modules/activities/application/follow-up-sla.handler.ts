import { FollowUpStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import type { SlaTimer } from '../../../generated/prisma/client.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { SlaHandlerFor } from '../../sla/application/sla-handler.registry.js';
import type { SlaHandler } from '../../sla/domain/sla.types.js';
import { FOLLOW_UP_DUE_SLA_KIND, FOLLOW_UP_SLA_ENTITY } from '../domain/activity.constants.js';
import { ActivityRepository } from '../infrastructure/activity.repository.js';

@SlaHandlerFor(FOLLOW_UP_DUE_SLA_KIND)
export class FollowUpDueSlaHandler implements SlaHandler {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly outbox: OutboxService,
  ) {}

  async warn(timer: SlaTimer) {
    const followUp = await this.activities.findFollowUp({ id: timer.entityId, status: FollowUpStatus.open });
    if (!followUp) return;
    await this.outbox.publish({
      name: EventName.FollowUpDue,
      aggregateType: FOLLOW_UP_SLA_ENTITY,
      aggregateId: followUp.id,
      payload: { followUpId: followUp.id, entityType: followUp.entityType, entityId: followUp.entityId, organizationId: followUp.organizationId, assigneeUserId: followUp.assigneeUserId, dueAt: followUp.dueAt.toISOString() },
    });
  }
}
