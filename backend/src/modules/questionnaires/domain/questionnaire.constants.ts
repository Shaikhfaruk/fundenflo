import { AttributeDataType, QuestionType } from '../../../common/enums/db.enums.js';
import { QuestionKind, type QuestionValidation } from '../../../engines/questionnaire/questionnaire.types.js';

export const QUESTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const OPTION_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_+-]{0,63}$/;

export const SECTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export const SCOPE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const MAX_ANSWERS_PER_WRITE = 100;

export const MAX_UI_HINTS = 20;

export const QuestionnaireStage = {
  PreCheck: 'pre_check',
  Profile: 'profile',
  LeadCapture: 'lead_capture',
  LenderSpecific: 'lender_specific',
  PostSanction: 'post_sanction',
} as const;

export type QuestionnaireStage = (typeof QuestionnaireStage)[keyof typeof QuestionnaireStage];

export const QUESTION_KIND: Record<QuestionType, QuestionKind> = {
  [QuestionType.single_select]: QuestionKind.SingleSelect,
  [QuestionType.multi_select]: QuestionKind.MultiSelect,
  [QuestionType.number]: QuestionKind.Number,
  [QuestionType.money]: QuestionKind.Money,
  [QuestionType.date]: QuestionKind.Date,
  [QuestionType.text]: QuestionKind.Text,
  [QuestionType.boolean]: QuestionKind.Boolean,
  [QuestionType.city]: QuestionKind.City,
  [QuestionType.pincode]: QuestionKind.Pincode,
};

const { integer, decimal, money, percentage, boolean, string, date } = AttributeDataType;

export const QUESTION_TYPE_DATA_TYPES: Record<QuestionType, AttributeDataType[]> = {
  [QuestionType.single_select]: [AttributeDataType.enum, boolean, integer, decimal, money, percentage, string],
  [QuestionType.multi_select]: [AttributeDataType.enum, string],
  [QuestionType.number]: [integer, decimal, percentage],
  [QuestionType.money]: [money],
  [QuestionType.date]: [date],
  [QuestionType.text]: [string],
  [QuestionType.boolean]: [boolean],
  [QuestionType.city]: [string],
  [QuestionType.pincode]: [string],
};

export const SELECT_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([QuestionType.single_select, QuestionType.multi_select]);

export const QUESTION_VALIDATION_FIELDS: Record<QuestionType, Array<keyof QuestionValidation>> = {
  [QuestionType.single_select]: [],
  [QuestionType.multi_select]: ['maxSelections'],
  [QuestionType.number]: ['min', 'max'],
  [QuestionType.money]: ['min', 'max'],
  [QuestionType.date]: [],
  [QuestionType.text]: ['minLength', 'maxLength', 'pattern'],
  [QuestionType.boolean]: [],
  [QuestionType.city]: [],
  [QuestionType.pincode]: [],
};
