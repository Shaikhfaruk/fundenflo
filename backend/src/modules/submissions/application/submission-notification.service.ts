import { Injectable } from '@nestjs/common';

import { ConfigResource, NotificationChannel, SubmissionStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { localise, resolveLocale } from '../../../common/i18n/locale.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { UserNotifier } from '../../auth/application/user-notifier.service.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { DocumentTypeService } from '../../documents/application/document-type.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { SUBMISSION_NOTIFY_ROLES } from '../domain/submission.constants.js';
import { SubmissionRepository } from '../infrastructure/submission.repository.js';

const LENDER_CHANNELS = [NotificationChannel.email, NotificationChannel.push, NotificationChannel.sms] as const;

const BORROWER_CHANNELS = [NotificationChannel.push, NotificationChannel.sms] as const;

@Injectable()
export class SubmissionNotificationService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly applications: ApplicationService,
    private readonly memberships: MembershipService,
    private readonly config: ConfigPublishingService,
    private readonly types: DocumentTypeService,
    private readonly notifier: UserNotifier,
  ) {}

  async handle(envelope: DomainEventEnvelope): Promise<number> {
    const payload = envelope.payload as { submissionId?: string; documentRequestId?: string; to?: string };
    if (envelope.name === EventName.SubmissionStatusChanged && payload.submissionId && payload.to === SubmissionStatus.sent_to_lender) return this.lenderReceived(payload.submissionId);
    if (envelope.name === EventName.DocumentRequested && payload.documentRequestId) return this.documentsRequested(payload.documentRequestId);
    return 0;
  }

  private async lenderReceived(submissionId: string) {
    const submission = await this.submissions.findOne({ id: submissionId });
    if (!submission) return 0;
    const name = (await this.config.names(ConfigResource.lender_product, [submission.productDocumentId])).get(submission.productDocumentId);
    const userIds = await this.memberships.activeUserIds(submission.lenderOrganizationId, SUBMISSION_NOTIFY_ROLES);
    return this.notifier.notify(userIds, NotificationTemplateKey.SubmissionReceived, (locale) => ({ ref: submission.ref, product: localise(name, resolveLocale(locale ?? undefined)) || submission.productKey }), LENDER_CHANNELS);
  }

  private async documentsRequested(documentRequestId: string) {
    const request = await this.submissions.findRequest(documentRequestId);
    if (!request) return 0;
    const application = await this.applications.subject(request.applicationId);
    const labels = await this.types.activeByKeys(request.documentTypes);
    const params = (locale: string | null) => ({ ref: application.ref, documents: request.documentTypes.map((key) => localise(labels.get(key)?.label, resolveLocale(locale ?? undefined)) || key).join(', ') });
    let sent = await this.notifier.notifyParties([application.actingPartyId], NotificationTemplateKey.DocumentRequested, params, BORROWER_CHANNELS);
    if (application.partnerOrganizationId) sent += await this.notifier.notify([application.createdByUserId], NotificationTemplateKey.DocumentRequested, params, BORROWER_CHANNELS);
    return sent;
  }
}
