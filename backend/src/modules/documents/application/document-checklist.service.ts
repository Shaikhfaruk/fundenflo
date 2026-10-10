import { Injectable } from '@nestjs/common';

import { ConfigResource } from '../../../common/enums/db.enums.js';
import { type Locale, localise } from '../../../common/i18n/locale.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { coerceFactText } from '../../../engines/conditions/coerce.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import type { ChecklistContext, ChecklistItem, CompiledDocumentRequirement } from '../../../engines/documents/documents.types.js';
import { latestAssessmentYear, resolveChecklist } from '../../../engines/documents/resolve-checklist.js';
import { type SlotSatisfaction, satisfyChecklist } from '../../../engines/documents/satisfy-checklist.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { renderTemplate } from '../../notifications/domain/template-renderer.js';
import { DocumentTextParam } from '../domain/document.constants.js';
import { DocumentRepository } from '../infrastructure/document.repository.js';
import type { DocumentTypeView } from './document.views.js';
import { DocumentTypeService } from './document-type.service.js';

export type ChecklistHolder = { partyId: string; applicationId: string | null };

type HeldRow = Awaited<ReturnType<DocumentRepository['heldFor']>>[number];

@Injectable()
export class DocumentChecklistService {
  constructor(
    private readonly config: ConfigPublishingService,
    private readonly types: DocumentTypeService,
    private readonly facts: FactService,
    private readonly dictionary: AttributeDictionary,
    private readonly documents: DocumentRepository,
  ) {}

  async typedFacts(pairs: Array<[string, string]>): Promise<Record<string, FactValue>> {
    const resolver = await this.dictionary.specResolver();
    const typed: Record<string, FactValue> = {};
    const issues: Array<{ path: string; code: string; message: string }> = [];
    for (const [index, [attribute, raw]] of pairs.entries()) {
      const spec = resolver(attribute);
      const value = spec ? coerceFactText(spec, raw) : undefined;
      if (value === undefined) issues.push({ path: `fact.${index}`, code: spec ? 'invalid_value' : 'unknown_attribute', message: spec ? `${raw} is not a valid ${spec.dataType} for ${attribute}` : `unknown or inactive attribute ${attribute}` });
      else typed[attribute] = value;
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    return typed;
  }

  async checklist(context: ChecklistContext, locale: Locale, source: { partyId?: string; facts?: Record<string, FactValue> } = {}) {
    const published = await this.config.active<CompiledDocumentRequirement>(ConfigResource.document_requirement);
    const lookup = source.partyId || source.facts ? await this.facts.lookup(source.partyId ?? null, source.facts) : undefined;
    const checklist = resolveChecklist(published.map((entry) => ({ key: entry.key, versionId: entry.versionId, requirement: entry.compiled })), context, lookup);
    const types = await this.types.activeByKeys(checklist.items.flatMap((item) => item.documentTypes));
    const params = { [DocumentTextParam.AssessmentYear]: latestAssessmentYear() };
    const text = (value: unknown) => {
      const raw = localise(value, locale);
      return raw ? renderTemplate(raw, params) : null;
    };
    return {
      stage: context.stage,
      requirements: checklist.requirements,
      items: checklist.items.map((item) => this.view(item, types, text)),
      hidden: checklist.hidden,
    };
  }

  async heldChecklist(context: ChecklistContext, locale: Locale, holder: ChecklistHolder) {
    const base = await this.checklist(context, locale, { partyId: holder.partyId });
    const held = await this.documents.heldFor(holder.partyId, holder.applicationId);
    const slots = base.items.map((item) => ({ key: item.key, documentTypes: item.documentTypes.map((type) => type.key), minCount: item.minCount }));
    const satisfaction = satisfyChecklist(slots, held.map((document) => ({ id: document.id, documentType: document.documentType.key, freshUntil: document.freshUntil })));
    return { ...base, items: base.items.map((item) => ({ ...item, ...this.heldView(satisfaction.get(item.key), held) })) };
  }

  private heldView(slot: SlotSatisfaction | undefined, held: HeldRow[]) {
    const ids = new Set(slot?.documentIds ?? []);
    return {
      satisfied: slot?.satisfied ?? false,
      documents: held.filter((document) => ids.has(document.id)).map((document) => ({ id: document.id, documentType: document.documentType.key, status: document.status, fileName: document.fileName, applicationId: document.applicationId, createdAt: document.createdAt.toISOString() })),
    };
  }

  private view(item: ChecklistItem, types: Map<string, DocumentTypeView>, text: (value: unknown) => string | null) {
    const documentTypes = item.documentTypes.flatMap((key) => {
      const type = types.get(key);
      return type ? [{ key, label: text(type.label), description: text(type.description), icon: type.icon, acceptedMimeTypes: type.acceptedMimeTypes, maxSizeBytes: type.maxSizeBytes, periodRule: type.periodRule }] : [];
    });
    return {
      key: item.key,
      label: text(item.label) ?? documentTypes.map((type) => type.label).join(' Or '),
      description: text(item.description) ?? (documentTypes.length === 1 ? (documentTypes[0]?.description ?? null) : null),
      required: item.required,
      minCount: item.minCount,
      anyOf: documentTypes.length > 1,
      conditional: item.applicability !== 'pass',
      documentTypes,
      neededBy: item.neededBy,
    };
  }
}
