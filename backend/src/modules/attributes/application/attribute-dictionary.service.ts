import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { AttributeDataType, type AttributeSubject, CatalogStatus, type DataSensitivity, type FactProvenance } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import type { AttributeSpec, Condition, ConditionIssue, FactLookup } from '../../../engines/conditions/condition.types.js';
import { evaluateCondition, referencedAttributes } from '../../../engines/conditions/evaluate.js';
import { validateCondition } from '../../../engines/conditions/validate.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { runThenInvalidate } from '../../../infrastructure/cache/run-then-invalidate.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ATTRIBUTE_CACHE_TTL_SECONDS, AttributeCacheTag } from '../domain/attribute.constants.js';
import { type EnumOption, toConditionSpec } from '../domain/fact-value.js';
import { AttributeRepository } from '../infrastructure/attribute.repository.js';
import { type AttributeView, toAttributeView } from './attribute.views.js';

export type AttributeInput = {
  key: string;
  label: LocalisedText;
  description?: LocalisedText;
  dataType: AttributeDataType;
  unit?: string;
  enumValues?: EnumOption[];
  subject: AttributeSubject;
  sensitivity: DataSensitivity;
  allowedProvenance: FactProvenance[];
  freshnessDays?: number;
};

export type AttributePatch = {
  label?: LocalisedText;
  description?: LocalisedText | null;
  unit?: string | null;
  enumValues?: EnumOption[];
  sensitivity?: DataSensitivity;
  allowedProvenance?: FactProvenance[];
  freshnessDays?: number | null;
  status?: CatalogStatus;
};

@Injectable()
export class AttributeDictionary {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly attributes: AttributeRepository,
    private readonly cache: CacheService,
    private readonly changes: ChangeRecorder,
  ) {}

  async active(): Promise<Map<string, AttributeView>> {
    const views = await this.cache.wrap('attributes:active', [AttributeCacheTag], ATTRIBUTE_CACHE_TTL_SECONDS, async () =>
      (await this.attributes.list({ status: CatalogStatus.active })).map(toAttributeView),
    );
    return new Map(views.map((view) => [view.key, view]));
  }

  async specResolver(): Promise<(attr: string) => AttributeSpec | undefined> {
    const active = await this.active();
    return (attr) => {
      const view = active.get(attr);
      return view ? toConditionSpec({ dataType: view.dataType as AttributeDataType, enumValues: view.enumValues }) : undefined;
    };
  }

  async validate(condition: unknown): Promise<{ valid: boolean; issues: ConditionIssue[]; attributes: string[] }> {
    const issues = validateCondition(condition, await this.specResolver());
    return { valid: issues.length === 0, issues, attributes: issues.length === 0 ? referencedAttributes(condition as Condition) : [] };
  }

  async evaluate(condition: unknown, lookup: FactLookup) {
    const check = await this.validate(condition);
    if (!check.valid) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: check.issues.map((issue) => ({ ...issue, code: 'invalid_condition' })) });
    return evaluateCondition(condition as Condition, lookup);
  }

  async list(filters: { status?: CatalogStatus; subject?: AttributeSubject }) {
    return (await this.attributes.list(filters)).map(toAttributeView);
  }

  async get(id: string) {
    return toAttributeView(await this.require(id));
  }

  create(input: AttributeInput) {
    assertEnumShape(input.dataType, input.enumValues);
    return runThenInvalidate(this.txHost, this.cache, [AttributeCacheTag], async () => {
      const definition = await this.attributes.create({
        ...input,
        enumValues: input.enumValues ?? Prisma.DbNull,
        freshnessDays: input.freshnessDays ?? null,
      });
      await this.changes.record({ action: AuditAction.CatalogCreated, entityType: AuditEntity.AttributeDefinition, entityId: definition.id, metadata: { key: definition.key }, event: EventName.AttributeChanged });
      return toAttributeView(definition);
    });
  }

  update(id: string, patch: AttributePatch, expectedVersion: number | undefined) {
    return runThenInvalidate(this.txHost, this.cache, [AttributeCacheTag], async () => {
      const definition = await this.require(id);
      assertVersion(expectedVersion, definition.version);
      if (patch.enumValues) {
        assertEnumShape(definition.dataType, patch.enumValues);
        const kept = new Set(patch.enumValues.map((option) => option.value));
        const removed = ((definition.enumValues as EnumOption[] | null) ?? []).filter((option) => !kept.has(option.value));
        if (removed.length > 0) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, {
            details: [{ path: 'enumValues', code: 'enum_value_removed', message: `existing values cannot be removed: ${removed.map((option) => option.value).join(', ')}` }],
          });
        }
      }
      const result = await this.attributes.updateVersioned(id, definition.version, {
        ...patch,
        description: patch.description === null ? Prisma.DbNull : patch.description,
        enumValues: patch.enumValues,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: definition.version + 1 } });
      await this.changes.record({ action: AuditAction.CatalogChanged, entityType: AuditEntity.AttributeDefinition, entityId: id, metadata: { fields: Object.keys(patch) }, event: EventName.AttributeChanged });
      return toAttributeView(await this.require(id));
    });
  }

  private async require(id: string) {
    const definition = await this.attributes.findById(id);
    if (!definition) throw new AppError(ErrorCode.NOT_FOUND);
    return definition;
  }
}

function assertEnumShape(dataType: AttributeDataType, enumValues: EnumOption[] | undefined) {
  const isEnum = dataType === AttributeDataType.enum;
  if (isEnum && (!enumValues || enumValues.length === 0)) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'enumValues', code: 'required', message: 'enum attributes need enumValues' }] });
  }
  if (!isEnum && enumValues) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'enumValues', code: 'not_allowed', message: 'only enum attributes take enumValues' }] });
  }
  if (enumValues && new Set(enumValues.map((option) => option.value)).size !== enumValues.length) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'enumValues', code: 'duplicate', message: 'enum values must be unique' }] });
  }
}
