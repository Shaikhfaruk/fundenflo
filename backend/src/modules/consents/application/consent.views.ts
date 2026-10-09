import { type Locale, type LocalisedText, localise } from '../../../common/i18n/locale.js';
import type { ConsentState } from '../../../engines/consents/fold-consent.js';
import type { ConsentPurpose, ConsentRecord } from '../../../generated/prisma/client.js';
import type { CompiledConsentTemplate } from '../domain/consent-template.schema.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toPurposeView = (purpose: ConsentPurpose) => ({
  id: purpose.id,
  key: purpose.key,
  label: purpose.label as LocalisedText,
  description: (purpose.description as LocalisedText | null) ?? null,
  scopeKind: purpose.scopeKind,
  scopeOrganizationType: purpose.scopeOrganizationType,
  allowedBases: purpose.allowedBases,
  validityDays: purpose.validityDays,
  status: purpose.status,
  version: purpose.version,
  updatedAt: purpose.updatedAt.toISOString(),
});

export type PurposeView = ReturnType<typeof toPurposeView>;

export const toRecordView = (record: ConsentRecord) => ({
  id: record.id,
  purpose: record.purposeKey,
  granted: record.granted,
  basis: record.basis,
  organizationIds: (record.scope as { organizationIds?: string[] } | null)?.organizationIds ?? null,
  templateVersionId: record.templateVersionId,
  textHash: record.textHash,
  locale: record.locale,
  channel: record.channel,
  evidence: record.evidence,
  capturedByUserId: record.capturedByUserId,
  leadId: record.leadId,
  applicationId: record.applicationId,
  clientRecordedAt: iso(record.clientRecordedAt),
  expiresAt: iso(record.expiresAt),
  recordedAt: record.recordedAt.toISOString(),
});

export const toConsentStateView = (purpose: PurposeView, state: ConsentState, last: ConsentRecord | undefined, locale: Locale) => ({
  purpose: purpose.key,
  label: localise(purpose.label, locale),
  granted: state.granted,
  everyOrganization: state.everyOrganization,
  organizationIds: state.organizationIds,
  excludedOrganizationIds: state.excludedOrganizationIds,
  basis: last?.basis ?? null,
  channel: last?.channel ?? null,
  lastRecordId: state.lastEventId,
  lastChangedAt: iso(state.lastChangedAt),
  expiresAt: iso(state.expiresAt),
});

export const toTemplateView = (template: { key: string; versionId: string; number: number; compiled: CompiledConsentTemplate }, locale: Locale) => ({
  context: template.key,
  versionId: template.versionId,
  number: template.number,
  locale,
  policyUrl: template.compiled.policyUrl,
  items: template.compiled.items.map((item) => ({
    purpose: item.purpose,
    required: item.required,
    title: localise(item.title, locale),
    summary: item.summary ? localise(item.summary, locale) : null,
    details: localise(item.details, locale),
    textHash: item.textHash,
  })),
});
