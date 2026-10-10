import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { NotificationChannel } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import type { NotificationTemplateKey } from '../domain/notification.constants.js';
import { templateIssues } from '../domain/template-rules.js';
import { NotificationTemplateRepository } from '../infrastructure/notification-template.repository.js';
import { toTemplateView } from './notification.views.js';

export type TemplateFilter = { key?: string; channel?: NotificationChannel; locale?: string; active?: boolean };

export type TemplateInput = { key: NotificationTemplateKey; channel: NotificationChannel; locale: string; subject: string | null; body: string; providerTemplateId: string | null };

export type TemplatePatch = { subject?: string | null; body?: string; providerTemplateId?: string | null; active?: boolean };

const rejectIssues = (issues: ConfigIssue[]) => {
  if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
};

@Injectable()
export class NotificationTemplateService {
  constructor(
    private readonly templates: NotificationTemplateRepository,
    private readonly audit: AuditService,
  ) {}

  async list(filter: TemplateFilter) {
    return (await this.templates.list(filter)).map(toTemplateView);
  }

  @Transactional()
  async create(input: TemplateInput) {
    rejectIssues(templateIssues(input));
    if (await this.templates.findVariant(input.key, input.channel, input.locale)) {
      throw new AppError(ErrorCode.CONFLICT, { details: [{ path: 'locale', code: 'duplicate', message: `${input.key} already has a ${input.channel} template in ${input.locale}; edit that one` }] });
    }
    const template = await this.templates.create(input);
    await this.audit.record({ action: AuditAction.NotificationTemplateCreated, entityType: AuditEntity.NotificationTemplate, entityId: template.id, metadata: { key: template.key, channel: template.channel, locale: template.locale, providerTemplateId: template.providerTemplateId } });
    return toTemplateView(template);
  }

  @Transactional()
  async update(id: string, patch: TemplatePatch, expectedVersion: number | undefined) {
    const template = await this.templates.find(id);
    if (!template) throw new AppError(ErrorCode.NOT_FOUND);
    assertVersion(expectedVersion, template.version);
    const subject = patch.subject === undefined ? template.subject : patch.subject;
    const body = patch.body ?? template.body;
    const issues = templateIssues({ key: template.key as NotificationTemplateKey, channel: template.channel, subject, body });
    const textChanged = body !== template.body;
    const newDltId = patch.providerTemplateId !== undefined && patch.providerTemplateId !== template.providerTemplateId;
    if (template.channel === NotificationChannel.sms && textChanged && template.providerTemplateId && !newDltId) {
      issues.push({ path: 'providerTemplateId', code: 'dlt_template_required', message: 'register the new SMS text with DLT and send its template id in the same change' });
    }
    if (patch.active === false && template.locale === DEFAULT_LOCALE) {
      issues.push({ path: 'active', code: 'default_locale_required', message: `the ${DEFAULT_LOCALE} template is the fallback for every language and stays active` });
    }
    rejectIssues(issues);
    const result = await this.templates.updateVersioned(id, template.version, patch);
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: template.version + 1 } });
    await this.audit.record({
      action: AuditAction.NotificationTemplateChanged,
      entityType: AuditEntity.NotificationTemplate,
      entityId: id,
      metadata: { key: template.key, channel: template.channel, locale: template.locale, fields: Object.keys(patch), fromVersion: template.version, previousProviderTemplateId: template.providerTemplateId },
    });
    const updated = await this.templates.find(id);
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND);
    return toTemplateView(updated);
  }
}
