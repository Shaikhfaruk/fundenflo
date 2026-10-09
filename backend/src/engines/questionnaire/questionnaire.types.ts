import type { LocalisedText } from '../../common/i18n/locale.js';
import type { Condition, FactValue, Outcome } from '../conditions/condition.types.js';

export const QuestionKind = {
  SingleSelect: 'single_select',
  MultiSelect: 'multi_select',
  Number: 'number',
  Money: 'money',
  Date: 'date',
  Text: 'text',
  Boolean: 'boolean',
  City: 'city',
  Pincode: 'pincode',
} as const;

export type QuestionKind = (typeof QuestionKind)[keyof typeof QuestionKind];

export type QuestionOption = { value: string; label: LocalisedText; fact: FactValue };

export type QuestionValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  maxSelections?: number;
};

export type CompiledQuestion = {
  key: string;
  attributeKey: string;
  kind: QuestionKind;
  label: LocalisedText;
  help: LocalisedText | null;
  options: QuestionOption[] | null;
  validation: QuestionValidation | null;
  ui: Record<string, unknown> | null;
};

export type CompiledItem = {
  question: CompiledQuestion;
  required: boolean;
  section: string | null;
  visibleIf: Condition | null;
};

export type QuestionScope = {
  segments?: string[];
  subSegments?: string[];
  categories?: string[];
  leadSources?: string[];
};

export type QuestionSection = { key: string; label: LocalisedText };

export type CompiledQuestionSet = {
  stage: string;
  scope: QuestionScope;
  sections: QuestionSection[];
  items: CompiledItem[];
};

export type ActiveQuestionSet = { key: string; versionId: string; number: number; set: CompiledQuestionSet };

export type QuestionnaireContext = {
  stage: string;
  segment?: string;
  subSegment?: string;
  category?: string;
  leadSource?: string;
};

export type ResolvedQuestion = CompiledItem & { setKey: string; setVersionId: string; visibility: Outcome };

export type ResolvedQuestionnaire = {
  sets: Array<{ key: string; versionId: string; number: number }>;
  sections: QuestionSection[];
  questions: ResolvedQuestion[];
  hidden: string[];
};

export type AnswerResult = { ok: true; value: FactValue } | { ok: false; message: string };
