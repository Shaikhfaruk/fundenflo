import { z } from 'zod';

import { CatalogStatus, QuestionType } from '../../../common/enums/db.enums.js';
import { localisedTextSchema } from '../../../common/i18n/locale.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { QUESTIONNAIRE_LIMITS } from '../../../engines/questionnaire/questionnaire.constants.js';
import { attributeKeySchema } from '../../attributes/http/attributes.dto.js';
import { MAX_ANSWERS_PER_WRITE, MAX_UI_HINTS, OPTION_VALUE_PATTERN, QUESTION_KEY_PATTERN, QuestionnaireStage, SCOPE_KEY_PATTERN } from '../domain/questionnaire.constants.js';

const questionKeySchema = z.string().trim().regex(QUESTION_KEY_PATTERN, 'use lowercase letters, digits and underscores');

const optionSchema = z.object({ value: z.string().trim().regex(OPTION_VALUE_PATTERN), label: localisedTextSchema, fact: z.unknown() }).strict();

const validationSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minLength: z.number().int().min(0).max(QUESTIONNAIRE_LIMITS.maxTextLength).optional(),
    maxLength: z.number().int().min(1).max(QUESTIONNAIRE_LIMITS.maxTextLength).optional(),
    pattern: z.string().min(1).max(QUESTIONNAIRE_LIMITS.maxPatternLength).optional(),
    maxSelections: z.number().int().min(1).max(QUESTIONNAIRE_LIMITS.maxOptions).optional(),
  })
  .strict();

const uiSchema = z
  .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/), z.union([z.string().max(200), z.number().finite(), z.boolean()]))
  .refine((hints) => Object.keys(hints).length <= MAX_UI_HINTS, { message: `at most ${MAX_UI_HINTS} ui hints` });

export const listQuestionsSchema = z.object({ status: z.enum(Object.values(CatalogStatus)).optional(), attributeKey: attributeKeySchema.optional() });
export type ListQuestionsQuery = z.output<typeof listQuestionsSchema>;

export const createQuestionSchema = z
  .object({
    key: questionKeySchema,
    attributeKey: attributeKeySchema,
    type: z.enum(Object.values(QuestionType)),
    label: localisedTextSchema,
    help: localisedTextSchema.optional(),
    options: z.array(optionSchema).min(1).max(QUESTIONNAIRE_LIMITS.maxOptions).optional(),
    validation: validationSchema.optional(),
    ui: uiSchema.optional(),
  })
  .strict();
export type CreateQuestionDto = z.output<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    label: localisedTextSchema.optional(),
    help: localisedTextSchema.nullable().optional(),
    options: z.array(optionSchema).min(1).max(QUESTIONNAIRE_LIMITS.maxOptions).optional(),
    validation: validationSchema.nullable().optional(),
    ui: uiSchema.nullable().optional(),
    status: z.enum(Object.values(CatalogStatus)).optional(),
  })
  .strict();
export type UpdateQuestionDto = z.output<typeof updateQuestionSchema>;

const scopeKey = z.string().trim().regex(SCOPE_KEY_PATTERN).optional();

export const questionnaireContextSchema = z.object({
  stage: z.enum(Object.values(QuestionnaireStage)),
  segment: scopeKey,
  subSegment: scopeKey,
  category: scopeKey,
  leadSource: scopeKey,
});
export type QuestionnaireContextQuery = z.output<typeof questionnaireContextSchema>;

export const previewQuestionSetSchema = z
  .object({
    segment: scopeKey,
    subSegment: scopeKey,
    category: scopeKey,
    leadSource: scopeKey,
    partyId: z.uuid().optional(),
    facts: z.record(attributeKeySchema, z.unknown()).optional(),
  })
  .strict();
export type PreviewQuestionSetDto = z.output<typeof previewQuestionSetSchema>;

export const submitAnswersSchema = questionnaireContextSchema
  .extend({
    answers: z
      .array(z.object({ questionKey: questionKeySchema, value: z.unknown() }).strict())
      .min(1)
      .max(MAX_ANSWERS_PER_WRITE),
  })
  .strict();
export type SubmitAnswersDto = z.output<typeof submitAnswersSchema>;

export const answerHistorySchema = pageQuerySchema.extend({ questionKey: questionKeySchema.optional() });
export type AnswerHistoryQuery = z.output<typeof answerHistorySchema>;
