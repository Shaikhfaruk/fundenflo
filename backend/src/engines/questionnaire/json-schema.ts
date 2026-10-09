import { assertNever } from '../../common/utils/assert-never.js';
import { PINCODE_PATTERN, QUESTIONNAIRE_LIMITS } from './questionnaire.constants.js';
import { type CompiledQuestion, QuestionKind } from './questionnaire.types.js';

type JsonSchema = Record<string, unknown>;

const defined = (schema: JsonSchema): JsonSchema => Object.fromEntries(Object.entries(schema).filter(([, value]) => value !== undefined));

export function questionJsonSchema(question: CompiledQuestion): JsonSchema {
  const validation = question.validation ?? {};
  const values = question.options?.map((option) => option.value) ?? [];
  switch (question.kind) {
    case QuestionKind.SingleSelect:
      return { type: 'string', enum: values };
    case QuestionKind.MultiSelect:
      return defined({ type: 'array', items: { type: 'string', enum: values }, uniqueItems: true, minItems: 1, maxItems: validation.maxSelections });
    case QuestionKind.Number:
      return defined({ type: 'number', minimum: validation.min, maximum: validation.max });
    case QuestionKind.Money:
      return defined({ type: 'integer', minimum: validation.min, maximum: validation.max });
    case QuestionKind.Boolean:
      return { type: 'boolean' };
    case QuestionKind.Date:
      return { type: 'string', format: 'date' };
    case QuestionKind.Text:
      return defined({ type: 'string', minLength: validation.minLength ?? 1, maxLength: validation.maxLength ?? QUESTIONNAIRE_LIMITS.maxTextLength, pattern: validation.pattern });
    case QuestionKind.City:
      return { type: 'string', format: 'uuid' };
    case QuestionKind.Pincode:
      return { type: 'string', pattern: PINCODE_PATTERN.source };
    default:
      return assertNever(question.kind);
  }
}
