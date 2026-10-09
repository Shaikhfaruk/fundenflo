import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type AttributeDataType, type CatalogStatus, QuestionType } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import { isValidPattern } from '../../../common/utils/regex.js';
import { QUESTIONNAIRE_LIMITS } from '../../../engines/questionnaire/questionnaire.constants.js';
import type { QuestionOption, QuestionValidation } from '../../../engines/questionnaire/questionnaire.types.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import type { AttributeView } from '../../attributes/application/attribute.views.js';
import { normaliseFactValue } from '../../attributes/domain/fact-value.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { QUESTION_TYPE_DATA_TYPES, QUESTION_VALIDATION_FIELDS, SELECT_QUESTION_TYPES } from '../domain/questionnaire.constants.js';
import { QuestionRepository } from '../infrastructure/question.repository.js';
import { toQuestionView } from './questionnaire.views.js';

export type QuestionInput = {
  key: string;
  attributeKey: string;
  type: QuestionType;
  label: LocalisedText;
  help?: LocalisedText;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  ui?: Record<string, string | number | boolean>;
};

export type QuestionPatch = {
  label?: LocalisedText;
  help?: LocalisedText | null;
  options?: QuestionOption[];
  validation?: QuestionValidation | null;
  ui?: Record<string, string | number | boolean> | null;
  status?: CatalogStatus;
};

type Shape = { type: QuestionType; attributeKey: string; options: QuestionOption[] | null; validation: QuestionValidation | null };

const nullable = <T>(value: T | null | undefined) => (value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue | undefined));

@Injectable()
export class QuestionService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly questions: QuestionRepository,
    private readonly dictionary: AttributeDictionary,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(filters: { status?: CatalogStatus; attributeKey?: string }) {
    return (await this.questions.list(filters)).map(toQuestionView);
  }

  async get(id: string) {
    return toQuestionView(await this.require(id));
  }

  create(input: QuestionInput) {
    return this.txHost.withTransaction(async () => {
      const options = await this.checkShape({ type: input.type, attributeKey: input.attributeKey, options: input.options ?? null, validation: input.validation ?? null });
      const question = await this.questions.create({
        key: input.key,
        attributeKey: input.attributeKey,
        type: input.type,
        label: input.label,
        help: nullable(input.help),
        options: nullable(options),
        validation: nullable(input.validation),
        ui: nullable(input.ui),
      });
      await this.changes.record({
        action: AuditAction.QuestionCreated,
        entityType: AuditEntity.Question,
        entityId: question.id,
        event: EventName.QuestionChanged,
        metadata: { key: question.key, attributeKey: question.attributeKey, type: question.type },
      });
      return toQuestionView(question);
    });
  }

  update(id: string, patch: QuestionPatch, expectedVersion: number | undefined) {
    return this.txHost.withTransaction(async () => {
      const question = await this.require(id);
      assertVersion(expectedVersion, question.version);
      const current = toQuestionView(question);
      const options =
        patch.options !== undefined || patch.validation !== undefined
          ? await this.checkShape({
              type: question.type,
              attributeKey: question.attributeKey,
              options: patch.options ?? current.options,
              validation: patch.validation === undefined ? current.validation : patch.validation,
            })
          : undefined;
      const result = await this.questions.updateVersioned(id, question.version, {
        label: patch.label,
        help: nullable(patch.help),
        options: nullable(options),
        validation: nullable(patch.validation),
        ui: nullable(patch.ui),
        status: patch.status,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: question.version + 1 } });
      await this.changes.record({
        action: AuditAction.QuestionChanged,
        entityType: AuditEntity.Question,
        entityId: id,
        event: EventName.QuestionChanged,
        metadata: { key: question.key, fields: Object.keys(patch) },
      });
      return this.get(id);
    });
  }

  private async checkShape(shape: Shape): Promise<QuestionOption[] | undefined> {
    const issues: ConfigIssue[] = [];
    const attribute = (await this.dictionary.active()).get(shape.attributeKey);
    if (!attribute) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'attributeKey', code: 'unknown_attribute', message: `unknown or inactive attribute ${shape.attributeKey}` }] });
    }
    const dataType = attribute.dataType as AttributeDataType;
    if (!QUESTION_TYPE_DATA_TYPES[shape.type].includes(dataType)) {
      issues.push({ path: 'type', code: 'type_mismatch', message: `${shape.type} questions cannot fill ${dataType} attributes` });
    }
    this.checkValidation(shape, issues);
    const options = this.checkOptions(shape, attribute, issues);
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    return options;
  }

  private checkOptions(shape: Shape, attribute: AttributeView, issues: ConfigIssue[]): QuestionOption[] | undefined {
    const isSelect = SELECT_QUESTION_TYPES.has(shape.type);
    if (!isSelect) {
      if (shape.options) issues.push({ path: 'options', code: 'not_allowed', message: `${shape.type} questions take no options` });
      return undefined;
    }
    if (!shape.options || shape.options.length === 0) {
      issues.push({ path: 'options', code: 'required', message: `${shape.type} questions need options` });
      return undefined;
    }
    if (shape.options.length > QUESTIONNAIRE_LIMITS.maxOptions) issues.push({ path: 'options', code: 'too_big', message: `at most ${QUESTIONNAIRE_LIMITS.maxOptions} options` });
    if (new Set(shape.options.map((option) => option.value)).size !== shape.options.length) {
      issues.push({ path: 'options', code: 'duplicate', message: 'option values must be unique' });
    }
    const attributeShape = { dataType: attribute.dataType as AttributeDataType, enumValues: attribute.enumValues };
    return shape.options.map((option, index) => {
      const normalised = normaliseFactValue(attributeShape, option.fact);
      if (!normalised.ok) {
        issues.push({ path: `options.${index}.fact`, code: 'invalid_fact', message: normalised.message });
        return option;
      }
      if (shape.type !== QuestionType.single_select && (normalised.value === null || typeof normalised.value === 'object')) {
        issues.push({ path: `options.${index}.fact`, code: 'invalid_fact', message: 'multi-select options must map to a single value' });
      }
      return { ...option, fact: normalised.value };
    });
  }

  private checkValidation(shape: Shape, issues: ConfigIssue[]) {
    const validation = shape.validation;
    if (!validation) return;
    const allowed = new Set(QUESTION_VALIDATION_FIELDS[shape.type]);
    for (const field of Object.keys(validation)) {
      if (!allowed.has(field as keyof QuestionValidation)) issues.push({ path: `validation.${field}`, code: 'not_allowed', message: `${shape.type} questions do not use ${field}` });
    }
    if (validation.min !== undefined && validation.max !== undefined && validation.min > validation.max) {
      issues.push({ path: 'validation.min', code: 'invalid_range', message: 'min must not exceed max' });
    }
    if (validation.minLength !== undefined && validation.maxLength !== undefined && validation.minLength > validation.maxLength) {
      issues.push({ path: 'validation.minLength', code: 'invalid_range', message: 'minLength must not exceed maxLength' });
    }
    if (validation.pattern !== undefined && (validation.pattern.length > QUESTIONNAIRE_LIMITS.maxPatternLength || !isValidPattern(validation.pattern))) {
      issues.push({ path: 'validation.pattern', code: 'invalid_pattern', message: `pattern must be a valid regular expression of at most ${QUESTIONNAIRE_LIMITS.maxPatternLength} characters` });
    }
    if (shape.type === QuestionType.money && [validation.min, validation.max].some((bound) => bound !== undefined && !Number.isSafeInteger(bound))) {
      issues.push({ path: 'validation', code: 'not_whole', message: 'money limits are whole paise' });
    }
  }

  private async require(id: string) {
    const question = await this.questions.findById(id);
    if (!question) throw new AppError(ErrorCode.NOT_FOUND);
    return question;
  }
}
