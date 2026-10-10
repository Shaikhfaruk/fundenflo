import { localise, DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AuditEntity } from '../../audit/domain/audit.constants.js';
import { SubscriptionTargetFor } from '../../subscriptions/application/subscription-target.registry.js';
import { SubscriptionEvent } from '../../subscriptions/domain/subscription.constants.js';
import type { SubscriptionDelivery, SubscriptionTarget } from '../../subscriptions/domain/subscription-target.types.js';
import { SUBMISSION_STATUS_LABELS } from '../domain/submission.constants.js';
import { SubmissionService } from './submission.service.js';

@SubscriptionTargetFor(SubscriptionEvent.SubmissionStatusChanged)
export class SubmissionStatusSubscriptionTarget implements SubscriptionTarget {
  readonly entityType = AuditEntity.LenderSubmission;
  readonly payloadKey = 'submissionId';
  readonly oneShot = false;

  constructor(private readonly submissions: SubmissionService) {}

  async assertVisible(entityId: string, ability: AppAbility) {
    await this.submissions.visibleFor(entityId, ability, AppAction.Read);
  }

  async delivery(entityId: string): Promise<SubscriptionDelivery | null> {
    const submission = await this.submissions.subject(entityId);
    if (!submission.sentAt) return null;
    return { templateKey: NotificationTemplateKey.SubmissionStatusChanged, params: { ref: submission.ref, lender: submission.lenderName ?? 'the lender', status: localise(SUBMISSION_STATUS_LABELS[submission.status], DEFAULT_LOCALE) } };
  }
}
