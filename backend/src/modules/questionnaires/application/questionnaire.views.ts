import { type Locale, type LocalisedText, localise } from '../../../common/i18n/locale.js';
import { questionJsonSchema } from '../../../engines/questionnaire/json-schema.js';
import type { CompiledQuestion, QuestionOption, QuestionValidation, ResolvedQuestionnaire } from '../../../engines/questionnaire/questionnaire.types.js';
import type { Answer, Question } from '../../../generated/prisma/client.js';
import { QUESTION_KIND } from '../domain/questionnaire.constants.js';

export const toQuestionView = (question: Question) => ({
  id: question.id,
  key: question.key,
  attributeKey: question.attributeKey,
  type: question.type,
  label: question.label as LocalisedText,
  help: (question.help as LocalisedText | null) ?? null,
  options: (question.options as QuestionOption[] | null) ?? null,
  validation: (question.validation as QuestionValidation | null) ?? null,
  ui: (question.ui as Record<string, unknown> | null) ?? null,
  status: question.status,
  version: question.version,
  updatedAt: question.updatedAt.toISOString(),
});

export const compileQuestion = (question: Question): CompiledQuestion => ({
  key: question.key,
  attributeKey: question.attributeKey,
  kind: QUESTION_KIND[question.type],
  label: question.label as LocalisedText,
  help: (question.help as LocalisedText | null) ?? null,
  options: (question.options as QuestionOption[] | null) ?? null,
  validation: (question.validation as QuestionValidation | null) ?? null,
  ui: (question.ui as Record<string, unknown> | null) ?? null,
});

export const toQuestionnaireView = (questionnaire: ResolvedQuestionnaire, locale: Locale) => ({
  sets: questionnaire.sets,
  sections: questionnaire.sections.map((section) => ({ key: section.key, label: localise(section.label, locale) })),
  questions: questionnaire.questions.map((item) => ({
    key: item.question.key,
    attributeKey: item.question.attributeKey,
    type: item.question.kind,
    label: localise(item.question.label, locale),
    help: item.question.help ? localise(item.question.help, locale) : null,
    options: item.question.options?.map((option) => ({ value: option.value, label: localise(option.label, locale) })) ?? null,
    required: item.required,
    section: item.section,
    ui: item.question.ui,
    schema: questionJsonSchema(item.question),
    visibleIf: item.visibleIf,
    visibility: item.visibility,
    setKey: item.setKey,
    setVersionId: item.setVersionId,
  })),
  hidden: questionnaire.hidden,
});

export const toAnswerView = (answer: Answer) => ({
  id: answer.id,
  questionKey: answer.questionKey,
  questionSetVersionId: answer.questionSetVersionId,
  value: answer.value,
  factId: answer.factId,
  channel: answer.channel,
  answeredByUserId: answer.answeredByUserId,
  leadId: answer.leadId,
  applicationId: answer.applicationId,
  createdAt: answer.createdAt.toISOString(),
});
