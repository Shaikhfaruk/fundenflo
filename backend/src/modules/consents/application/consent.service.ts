import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { RequestContext } from '../../../common/context/request-context.service.js';
import { ConfigResource, ConsentBasis, type ConsentChannel, ConsentScopeKind } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { consentAllows, type ConsentState, foldConsent } from '../../../engines/consents/fold-consent.js';
import type { ConsentRecord, Prisma } from '../../../generated/prisma/client.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { PartyService } from '../../parties/application/party.service.js';
import type { CompiledConsentTemplate } from '../domain/consent-template.schema.js';
import { TEMPLATE_REQUIRED_CHANNELS } from '../domain/consent.constants.js';
import { ConsentRepository } from '../infrastructure/consent.repository.js';
import { ConsentPurposeService } from './consent-purpose.service.js';
import { type PurposeView, toConsentStateView, toRecordView } from './consent.views.js';

export type ConsentItemInput = { purpose: string; granted: boolean; organizationIds?: string[] };

export type ConsentCapture = {
  channel: ConsentChannel;
  basis?: ConsentBasis;
  templateVersionId?: string;
  locale?: Locale;
  evidence?: string;
  capturedByUserId?: string;
  leadId?: string;
  applicationId?: string;
  clientRecordedAt?: Date;
};

export type ConsentCheck = { organizationId?: string; explicitOnly?: boolean };

const toEvent = (record: ConsentRecord) => ({
  id: record.id,
  granted: record.granted,
  organizationIds: (record.scope as { organizationIds?: string[] } | null)?.organizationIds ?? null,
  recordedAt: record.recordedAt,
  expiresAt: record.expiresAt,
});

@Injectable()
export class ConsentService {
  constructor(
    private readonly consents: ConsentRepository,
    private readonly purposes: ConsentPurposeService,
    private readonly config: ConfigPublishingService,
    private readonly parties: PartyService,
    private readonly access: AccessRepository,
    private readonly context: RequestContext,
    private readonly changes: ChangeRecorder,
  ) {}

  async template(contextKey: string) {
    const active = (await this.config.active<CompiledConsentTemplate>(ConfigResource.consent_template)).find((entry) => entry.key === contextKey);
    if (!active) throw new AppError(ErrorCode.NOT_FOUND, { details: { context: contextKey } });
    return { key: active.key, versionId: active.versionId, number: active.number, compiled: active.compiled };
  }

  @Transactional()
  async record(partyId: string, items: ConsentItemInput[], capture: ConsentCapture, locale: Locale) {
    await this.parties.assertExists(partyId);
    const purposes = await this.purposes.active();
    const basis = capture.basis ?? ConsentBasis.consent;
    const template = capture.templateVersionId ? await this.config.pinnedVersion<CompiledConsentTemplate>(ConfigResource.consent_template, capture.templateVersionId) : null;
    const issues: ConfigIssue[] = [];
    if (capture.templateVersionId && !template) issues.push({ path: 'templateVersionId', code: 'unknown_template', message: 'not a published consent template version' });
    const needsTemplate = basis === ConsentBasis.consent && TEMPLATE_REQUIRED_CHANNELS.has(capture.channel) && items.some((item) => item.granted);
    if (needsTemplate && !capture.templateVersionId) issues.push({ path: 'templateVersionId', code: 'required', message: `consent captured through ${capture.channel} must cite the template version shown` });
    if (!capture.evidence && items.some((item) => item.granted) && (basis === ConsentBasis.legitimate_use || (!capture.templateVersionId && !needsTemplate))) {
      issues.push({ path: 'evidence', code: 'required', message: 'describe where and how this consent or lawful basis was obtained' });
    }

    const organizationIds = [...new Set(items.flatMap((item) => item.organizationIds ?? []))];
    const organizations = new Map((organizationIds.length > 0 ? await this.access.findOrganizations(organizationIds) : []).map((organization) => [organization.id, organization]));
    const seen = new Set<string>();
    const now = new Date();
    const rows: Prisma.ConsentRecordCreateManyInput[] = [];
    for (const [index, item] of items.entries()) {
      const path = `items.${index}`;
      const purpose = purposes.get(item.purpose);
      if (seen.has(item.purpose)) issues.push({ path: `${path}.purpose`, code: 'duplicate', message: `${item.purpose} is listed twice` });
      seen.add(item.purpose);
      if (!purpose) {
        issues.push({ path: `${path}.purpose`, code: 'unknown_purpose', message: `unknown or inactive purpose ${item.purpose}` });
        continue;
      }
      if (item.granted && !purpose.allowedBases.includes(basis)) issues.push({ path: `${path}.purpose`, code: 'basis_not_allowed', message: `${item.purpose} cannot rest on ${basis}` });
      this.checkScope(purpose, item, organizations, path, issues);
      const templateItem = template?.compiled.items.find((candidate) => candidate.purpose === item.purpose);
      if (template && !templateItem) issues.push({ path: `${path}.purpose`, code: 'not_in_template', message: `${item.purpose} is not part of template version ${template.number}` });
      rows.push({
        partyId,
        purposeKey: item.purpose,
        granted: item.granted,
        basis,
        scope: item.organizationIds ? { organizationIds: [...new Set(item.organizationIds)].toSorted() } : undefined,
        templateVersionId: template?.versionId ?? null,
        textHash: templateItem?.textHash ?? null,
        locale: template ? locale : null,
        channel: capture.channel,
        evidence: capture.evidence ?? null,
        capturedByUserId: capture.capturedByUserId ?? null,
        leadId: capture.leadId ?? null,
        applicationId: capture.applicationId ?? null,
        ip: this.context.ip ?? null,
        userAgent: this.context.userAgent ?? null,
        clientRecordedAt: capture.clientRecordedAt ?? null,
        expiresAt: item.granted && purpose.validityDays ? new Date(now.getTime() + purpose.validityDays * DAY_MS) : null,
      });
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });

    const created = await this.consents.createRecords(rows);
    for (const record of created) {
      const scopedTo = toEvent(record).organizationIds;
      await this.changes.record({
        action: record.granted ? AuditAction.ConsentGranted : AuditAction.ConsentWithdrawn,
        entityType: AuditEntity.ConsentRecord,
        entityId: record.id,
        event: record.granted ? EventName.ConsentGranted : EventName.ConsentWithdrawn,
        metadata: { partyId, purpose: record.purposeKey, basis: record.basis, channel: record.channel, organizationIds: scopedTo, templateVersionId: record.templateVersionId },
        payload: { partyId, purpose: record.purposeKey, organizationIds: scopedTo, leadId: record.leadId, applicationId: record.applicationId },
      });
    }

    const current = await this.current(partyId, locale);
    const granted = new Set(current.filter((state) => state.granted).map((state) => state.purpose));
    return {
      records: created.map(toRecordView),
      consents: current.filter((state) => seen.has(state.purpose)),
      missingRequired: template?.compiled.items.filter((item) => item.required && !granted.has(item.purpose)).map((item) => item.purpose) ?? [],
    };
  }

  async current(partyId: string, locale: Locale) {
    await this.parties.assertExists(partyId);
    const purposes = await this.purposes.active();
    const states = await this.states(partyId, [...purposes.keys()]);
    return [...purposes.values()].map((purpose) => {
      const entry = states.get(purpose.key);
      return toConsentStateView(purpose, entry?.state ?? foldConsent([], new Date()), entry?.last, locale);
    });
  }

  async history(partyId: string, query: PageQuery & { purpose?: string }) {
    await this.parties.assertExists(partyId);
    const window = pageWindow(query);
    const rows = await this.consents.history(partyId, query.purpose, window.take, window.idFilter);
    return toPage(rows, query.limit, toRecordView);
  }

  async hasConsent(partyId: string, purpose: string, check: ConsentCheck = {}): Promise<boolean> {
    const entry = (await this.states(partyId, [purpose])).get(purpose);
    return entry ? consentAllows(entry.state, check.organizationId, { explicitOnly: check.explicitOnly }) : false;
  }

  async summary(partyId: string, purposes: string[], check: ConsentCheck = {}): Promise<Map<string, { granted: boolean; recorded: boolean }>> {
    const states = await this.states(partyId, purposes);
    return new Map(
      purposes.map((purpose) => {
        const entry = states.get(purpose);
        return [purpose, { granted: entry ? consentAllows(entry.state, check.organizationId, { explicitOnly: check.explicitOnly }) : false, recorded: Boolean(entry) }];
      }),
    );
  }

  async assertConsent(partyId: string, purpose: string, check: ConsentCheck = {}): Promise<void> {
    if (!(await this.hasConsent(partyId, purpose, check))) throw new AppError(ErrorCode.CONSENT_REQUIRED, { details: { purpose, organizationId: check.organizationId ?? null } });
  }

  private async states(partyId: string, purposeKeys: string[]): Promise<Map<string, { state: ConsentState; last: ConsentRecord | undefined }>> {
    const records = await this.consents.listRecords(partyId, purposeKeys);
    const now = new Date();
    return new Map(
      [...Map.groupBy(records, (record) => record.purposeKey)].map(([key, group]) => {
        const state = foldConsent(group.map(toEvent), now);
        return [key, { state, last: group.find((record) => record.id === state.lastEventId) }];
      }),
    );
  }

  private checkScope(purpose: PurposeView, item: ConsentItemInput, organizations: Map<string, { type: string }>, path: string, issues: ConfigIssue[]) {
    if (!item.organizationIds) return;
    if (purpose.scopeKind === ConsentScopeKind.none) {
      issues.push({ path: `${path}.organizationIds`, code: 'not_allowed', message: `${purpose.key} is not scoped to organizations` });
      return;
    }
    for (const [index, id] of item.organizationIds.entries()) {
      const organization = organizations.get(id);
      if (!organization || organization.type !== purpose.scopeOrganizationType) {
        issues.push({ path: `${path}.organizationIds.${index}`, code: 'unknown_organization', message: `not a ${purpose.scopeOrganizationType ?? ''} organization` });
      }
    }
  }
}
