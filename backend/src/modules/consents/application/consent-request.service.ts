import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ConfigResource, ConsentChannel, ConsentRequestStatus, ContactType, NotificationChannel } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import { randomToken, sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { JobPriority } from '../../../infrastructure/queue/queue.constants.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import type { CompiledConsentTemplate } from '../domain/consent-template.schema.js';
import { CONSENT_LINK_TOKEN_PARAM, CONSENT_REQUEST_TOKEN_BYTES, CONSENT_REQUEST_TTL_DAYS } from '../domain/consent.constants.js';
import { ConsentRepository } from '../infrastructure/consent.repository.js';
import { type ConsentItemInput, ConsentService } from './consent.service.js';
import { toTemplateView } from './consent.views.js';

export type ConsentRequestInput = { contextKey: string; leadId?: string; reference?: string; requestedByUserId?: string };

const toRequestView = (request: { id: string; status: string; channel: string; recipientMasked: string; expiresAt: Date; leadId: string | null; createdAt: Date }) => ({
  id: request.id,
  status: request.status,
  channel: request.channel,
  recipient: request.recipientMasked,
  leadId: request.leadId,
  expiresAt: request.expiresAt.toISOString(),
  createdAt: request.createdAt.toISOString(),
});

@Injectable()
export class ConsentRequestService {
  constructor(
    private readonly repo: ConsentRepository,
    private readonly consents: ConsentService,
    private readonly config: ConfigPublishingService,
    private readonly parties: PartyService,
    private readonly notifications: NotificationService,
    private readonly changes: ChangeRecorder,
    @InjectConfig() private readonly app: AppConfig,
  ) {}

  async send(partyId: string, input: ConsentRequestInput) {
    const base = this.app.CONSENT_LINK_URL;
    if (!base) throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, { details: { reason: 'consent links are not configured (CONSENT_LINK_URL)' } });
    const prepared = await this.prepare(partyId, input);
    const link = new URL(base);
    link.searchParams.set(CONSENT_LINK_TOKEN_PARAM, prepared.token);
    await this.notifications.send({
      templateKey: NotificationTemplateKey.ConsentRequest,
      channel: NotificationChannel.sms,
      recipient: prepared.mobile,
      params: { link: link.toString(), ref: input.reference ?? '', expiresOn: prepared.request.expiresAt.toISOString().slice(0, 10) },
      priority: JobPriority.High,
    });
    return toRequestView(prepared.request);
  }

  async view(token: string, locale: Locale) {
    const request = await this.usable(token);
    const template = await this.config.pinnedVersion<CompiledConsentTemplate>(ConfigResource.consent_template, request.templateVersionId);
    if (!template) throw new AppError(ErrorCode.CONSENT_LINK_INVALID);
    return { expiresAt: request.expiresAt.toISOString(), template: toTemplateView(template, locale) };
  }

  @Transactional()
  async submit(token: string, items: ConsentItemInput[], locale: Locale) {
    const request = await this.usable(token);
    const result = await this.consents.record(request.partyId, items, { channel: request.channel, templateVersionId: request.templateVersionId, locale, leadId: request.leadId ?? undefined }, locale);
    const completed = await this.repo.completeRequest(request.id);
    if (completed.count === 0) throw new AppError(ErrorCode.CONSENT_LINK_INVALID);
    await this.changes.record({
      action: AuditAction.ConsentRequestCompleted,
      entityType: AuditEntity.ConsentRequest,
      entityId: request.id,
      event: EventName.ConsentRequested,
      metadata: { partyId: request.partyId, leadId: request.leadId, purposes: items.map((item) => item.purpose) },
      payload: { partyId: request.partyId, leadId: request.leadId, completed: true },
    });
    return { consents: result.consents, missingRequired: result.missingRequired };
  }

  @Transactional()
  private async prepare(partyId: string, input: ConsentRequestInput) {
    const template = await this.consents.template(input.contextKey);
    const mobile = (await this.parties.listContacts(partyId, true)).find((contact) => contact.type === ContactType.mobile && !contact.doNotContact && !contact.invalid && contact.value);
    if (!mobile?.value) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'party', code: 'no_reachable_mobile', message: 'this person has no mobile that may be contacted' }] });
    }
    await this.repo.cancelPendingRequests(partyId, template.versionId);
    const token = randomToken(CONSENT_REQUEST_TOKEN_BYTES);
    const request = await this.repo.createRequest({
      partyId,
      leadId: input.leadId ?? null,
      templateVersionId: template.versionId,
      tokenHash: sha256(token),
      channel: ConsentChannel.sms_link,
      recipientMasked: mobile.masked,
      expiresAt: new Date(Date.now() + CONSENT_REQUEST_TTL_DAYS * DAY_MS),
      createdByUserId: input.requestedByUserId ?? null,
    });
    await this.changes.record({
      action: AuditAction.ConsentRequested,
      entityType: AuditEntity.ConsentRequest,
      entityId: request.id,
      event: EventName.ConsentRequested,
      metadata: { partyId, leadId: input.leadId ?? null, context: input.contextKey, recipient: mobile.masked },
      payload: { partyId, leadId: input.leadId ?? null, completed: false },
    });
    return { request, token, mobile: mobile.value };
  }

  private async usable(token: string) {
    const request = await this.repo.findRequestByTokenHash(sha256(token));
    if (request?.status !== ConsentRequestStatus.pending) throw new AppError(ErrorCode.CONSENT_LINK_INVALID);
    if (request.expiresAt <= new Date()) {
      await this.repo.expireRequest(request.id);
      throw new AppError(ErrorCode.CONSENT_LINK_INVALID);
    }
    return request;
  }
}
