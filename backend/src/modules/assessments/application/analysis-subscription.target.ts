import { AnalysisStatus } from '../../../common/enums/db.enums.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { AuditEntity } from '../../audit/domain/audit.constants.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { SubscriptionTargetFor } from '../../subscriptions/application/subscription-target.registry.js';
import { SubscriptionEvent } from '../../subscriptions/domain/subscription.constants.js';
import type { SubscriptionDelivery, SubscriptionTarget } from '../../subscriptions/domain/subscription-target.types.js';
import { AnalysisService } from './analysis.service.js';

@SubscriptionTargetFor(SubscriptionEvent.AnalysisCompleted)
export class AnalysisSubscriptionTarget implements SubscriptionTarget {
  readonly entityType = AuditEntity.Analysis;
  readonly payloadKey = 'analysisId';
  readonly oneShot = true;

  constructor(
    private readonly analyses: AnalysisService,
    private readonly applications: ApplicationService,
  ) {}

  async assertVisible(entityId: string, ability: AppAbility) {
    await this.analyses.get(entityId, ability, DEFAULT_LOCALE);
  }

  async delivery(_entityId: string, payload: Record<string, unknown>): Promise<SubscriptionDelivery | null> {
    if (payload.status !== AnalysisStatus.done || typeof payload.applicationId !== 'string') return null;
    const application = await this.applications.subject(payload.applicationId);
    return { templateKey: NotificationTemplateKey.AnalysisCompleted, params: { ref: application.ref } };
  }
}
