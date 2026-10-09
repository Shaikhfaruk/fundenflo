import { QuestionType } from '../../common/enums/db.enums.js';
import type { FactValue } from '../../engines/conditions/condition.types.js';
import type { QuestionOption } from '../../engines/questionnaire/questionnaire.types.js';
import { QuestionnaireStage } from '../../modules/questionnaires/domain/questionnaire.constants.js';
import type { QuestionSetContent } from '../../modules/questionnaires/domain/question-set.schema.js';

export type QuestionSeed = {
  key: string;
  attributeKey: string;
  type: QuestionType;
  label: string;
  options: QuestionOption[];
  ui: Record<string, string | number | boolean>;
};

export type QuestionSetSeed = { key: string; name: string; content: QuestionSetContent };

const option = (value: string, label: string, fact: FactValue): QuestionOption => ({ value, label: { en: label }, fact });

const range = (min: number, max: number | null) => ({ min, max });

const CHIPS = { widget: 'chips', columns: 2 };

const YEARS_IN_MONTHS = [
  option('lt1', '< 1 Yr', range(0, 11)),
  option('1-3', '1–3 Yrs', range(12, 35)),
  option('3-5', '3–5 Yrs', range(36, 59)),
  option('5+', '5+ Yrs', range(60, null)),
];

const YES_NO_FIRST_NO = [option('no', 'No', false), option('yes', 'Yes', true)];

export const QUESTION_SEEDS: QuestionSeed[] = [
  { key: 'business_age', attributeKey: 'business.vintage_months', type: QuestionType.single_select, label: 'How Old Is The Business?', options: YEARS_IN_MONTHS, ui: CHIPS },
  {
    key: 'monthly_turnover',
    attributeKey: 'business.monthly_turnover_paise',
    type: QuestionType.single_select,
    label: 'Average Monthly Turnover',
    options: [
      option('lt5L', '< ₹5L', range(0, 49_999_999)),
      option('5-25L', '₹5–25L', range(50_000_000, 249_999_999)),
      option('25L-1Cr', '₹25L–1Cr', range(250_000_000, 999_999_999)),
      option('1Cr+', '₹1Cr+', range(1_000_000_000, null)),
    ],
    ui: CHIPS,
  },
  { key: 'existing_emis', attributeKey: 'borrower.has_existing_emis', type: QuestionType.single_select, label: 'Any Existing EMIs?', options: YES_NO_FIRST_NO, ui: CHIPS },
  {
    key: 'gst_registered',
    attributeKey: 'business.gst_registered',
    type: QuestionType.single_select,
    label: 'GST Registered?',
    options: [option('yes', 'Yes', true), option('no', 'No', false)],
    ui: CHIPS,
  },
  {
    key: 'employment',
    attributeKey: 'person.employment_type',
    type: QuestionType.single_select,
    label: 'How Do You Earn?',
    options: [option('salaried', 'Salaried', 'salaried'), option('self-employed', 'Self-employed', 'self_employed')],
    ui: CHIPS,
  },
  {
    key: 'monthly_income',
    attributeKey: 'person.net_monthly_income_paise',
    type: QuestionType.single_select,
    label: 'Net Monthly Income',
    options: [
      option('lt25K', '< ₹25K', range(0, 2_499_999)),
      option('25-50K', '₹25–50K', range(2_500_000, 4_999_999)),
      option('50K-1L', '₹50K–1L', range(5_000_000, 9_999_999)),
      option('1L+', '₹1L+', range(10_000_000, null)),
    ],
    ui: CHIPS,
  },
  { key: 'work_experience', attributeKey: 'person.work_experience_months', type: QuestionType.single_select, label: 'Years In Current Work', options: YEARS_IN_MONTHS, ui: CHIPS },
];

const items = (keys: string[]) => keys.map((questionKey) => ({ questionKey, required: true }));

export const QUESTION_SET_SEEDS: QuestionSetSeed[] = [
  {
    key: 'pre_check.msme',
    name: 'MSME Pre-Check',
    content: { stage: QuestionnaireStage.PreCheck, scope: { segments: ['msme'] }, sections: [], items: items(['business_age', 'monthly_turnover', 'existing_emis', 'gst_registered']) },
  },
  {
    key: 'pre_check.individual',
    name: 'Individual Pre-Check',
    content: { stage: QuestionnaireStage.PreCheck, scope: { segments: ['individual'] }, sections: [], items: items(['employment', 'monthly_income', 'work_experience', 'existing_emis']) },
  },
];
