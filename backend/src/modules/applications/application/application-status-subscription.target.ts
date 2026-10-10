import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { AuditEntity } from '../../audit/domain/audit.constants.js';
import { SubscriptionTargetFor } from '../../subscriptions/application/subscription-target.registry.js';
import { SubscriptionEvent } from '../../subscriptions/domain/subscription.constants.js';
import type { SubscriptionDelivery, SubscriptionTarget } from '../../subscriptions/domain/subscription-target.types.js';
import { ApplicationService } from './application.service.js';

@SubscriptionTargetFor(SubscriptionEvent.ApplicationStatusChanged)
export class ApplicationStatusSubscriptionTarget implements SubscriptionTarget {
  readonly entityType = AuditEntity.LoanApplication;
  readonly payloadKey = 'applicationId';
  readonly oneShot = false;

  constructor(private readonly applications: ApplicationService) {}

  async assertVisible(entityId: string, ability: AppAbility) {
    await this.applications.get(entityId, ability);
  }

  async delivery(entityId: string, payload: Record<string, unknown>): Promise<SubscriptionDelivery | null> {
    const application = await this.applications.subject(entityId);
    const status = typeof payload.to === 'string' ? payload.to.replaceAll('_', ' ') : null;
    return status ? { templateKey: NotificationTemplateKey.ApplicationStatusChanged, params: { ref: application.ref, status } } : null;
  }
}
