import { Injectable } from '@nestjs/common';

import { type CatalogStatus, type DataSensitivity } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { templatePlaceholders } from '../../notifications/domain/template-renderer.js';
import { DocumentTextParam } from '../domain/document.constants.js';
import { DocumentTypeRepository } from '../infrastructure/document-type.repository.js';
import { toDocumentTypeView } from './document.views.js';

export type DocumentTypeInput = {
  key: string;
  label: LocalisedText;
  description?: LocalisedText;
  icon?: string;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  periodRule?: string;
  freshnessDays?: number;
  extractorKey?: string;
  producesAttributes?: string[];
  retentionDays?: number;
  sensitivity: DataSensitivity;
};

export type DocumentTypePatch = Partial<Omit<DocumentTypeInput, 'key' | 'description'>> & { description?: LocalisedText | null; status?: CatalogStatus };

@Injectable()
export class DocumentTypeService {
  constructor(
    private readonly types: DocumentTypeRepository,
    private readonly dictionary: AttributeDictionary,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(status?: CatalogStatus) {
    return (await this.types.list({ status })).map(toDocumentTypeView);
  }

  async get(id: string) {
    return toDocumentTypeView(await this.require(id));
  }

  async activeByKeys(keys: string[]) {
    return new Map((await this.types.findActiveByKeys([...new Set(keys)])).map((type) => [type.key, toDocumentTypeView(type)]));
  }

  async create(input: DocumentTypeInput) {
    await this.assertAttributes(input.producesAttributes ?? []);
    assertDocumentText(input.description, 'description');
    const type = await this.types.create({ ...input, description: input.description ?? Prisma.DbNull, producesAttributes: input.producesAttributes ?? [] });
    await this.changes.record({ action: AuditAction.CatalogCreated, entityType: AuditEntity.DocumentType, entityId: type.id, event: EventName.DocumentTypeChanged, metadata: { key: type.key } });
    return toDocumentTypeView(type);
  }

  async update(id: string, patch: DocumentTypePatch, expectedVersion: number | undefined) {
    const type = await this.require(id);
    assertVersion(expectedVersion, type.version);
    if (patch.producesAttributes) await this.assertAttributes(patch.producesAttributes);
    if (patch.description) assertDocumentText(patch.description, 'description');
    const moved = await this.types.updateVersioned(id, type.version, { ...patch, description: patch.description === null ? Prisma.DbNull : patch.description });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: type.version + 1 } });
    await this.changes.record({ action: AuditAction.CatalogChanged, entityType: AuditEntity.DocumentType, entityId: id, event: EventName.DocumentTypeChanged, metadata: { key: type.key, fields: Object.keys(patch) } });
    return toDocumentTypeView(await this.require(id));
  }

  private async assertAttributes(keys: string[]) {
    const active = await this.dictionary.active();
    const issues = keys.flatMap((key, index) => (active.has(key) ? [] : [{ path: `producesAttributes.${index}`, code: 'unknown_attribute', message: `unknown or inactive attribute ${key}` }]));
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
  }

  private async require(id: string) {
    const type = await this.types.findById(id);
    if (!type) throw new AppError(ErrorCode.NOT_FOUND);
    return type;
  }
}

const ALLOWED_PARAMS: ReadonlySet<string> = new Set(Object.values(DocumentTextParam));

export function documentTextIssues(text: LocalisedText | null | undefined, path: string) {
  return Object.entries(text ?? {}).flatMap(([locale, value]) =>
    templatePlaceholders(value)
      .filter((name) => !ALLOWED_PARAMS.has(name))
      .map((name) => ({ path: `${path}.${locale}`, code: 'unknown_placeholder', message: `{{${name}}} is not available; use ${[...ALLOWED_PARAMS].map((param) => `{{${param}}}`).join(', ')}` })),
  );
}

function assertDocumentText(text: LocalisedText | null | undefined, path: string) {
  const issues = documentTextIssues(text, path);
  if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
}
