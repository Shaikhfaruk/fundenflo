import { assertNever } from '../../common/utils/assert-never.js';
import type { Scalar } from '../conditions/condition.types.js';
import { ISO_DATE_PATTERN, PINCODE_PATTERN, QUESTIONNAIRE_LIMITS, UUID_PATTERN } from './questionnaire.constants.js';
import { type AnswerResult, type CompiledQuestion, QuestionKind } from './questionnaire.types.js';

const fail = (message: string): AnswerResult => ({ ok: false, message });

const isValidDate = (value: string) => ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

function numeric(question: CompiledQuestion, raw: unknown, whole: boolean): AnswerResult {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail('must be a number');
  if (whole && !Number.isSafeInteger(raw)) return fail('must be a whole number');
  const { min, max } = question.validation ?? {};
  if (min !== undefined && raw < min) return fail(`must be at least ${min}`);
  if (max !== undefined && raw > max) return fail(`must be at most ${max}`);
  return { ok: true, value: raw };
}

function text(question: CompiledQuestion, raw: unknown): AnswerResult {
  if (typeof raw !== 'string') return fail('must be text');
  const value = raw.trim();
  const { minLength = 1, maxLength = QUESTIONNAIRE_LIMITS.maxTextLength, pattern } = question.validation ?? {};
  if (value.length < minLength) return fail(`must have at least ${minLength} characters`);
  if (value.length > maxLength) return fail(`must have at most ${maxLength} characters`);
  if (pattern && !new RegExp(pattern, 'u').test(value)) return fail('is not in the expected format');
  return { ok: true, value };
}

export function answerToFact(question: CompiledQuestion, raw: unknown): AnswerResult {
  if (raw === null || raw === undefined) return fail('an answer is required');
  switch (question.kind) {
    case QuestionKind.SingleSelect: {
      const option = typeof raw === 'string' ? question.options?.find((candidate) => candidate.value === raw) : undefined;
      return option ? { ok: true, value: option.fact } : fail('must be one of the listed options');
    }
    case QuestionKind.MultiSelect: {
      if (!Array.isArray(raw) || raw.length === 0) return fail('choose at least one option');
      const chosen = [...new Set(raw)];
      const limit = question.validation?.maxSelections;
      if (limit !== undefined && chosen.length > limit) return fail(`choose at most ${limit} options`);
      const facts: Scalar[] = [];
      for (const value of chosen) {
        const option = typeof value === 'string' ? question.options?.find((candidate) => candidate.value === value) : undefined;
        if (!option || option.fact === null || typeof option.fact === 'object') return fail('must only contain listed options');
        facts.push(option.fact);
      }
      return { ok: true, value: facts };
    }
    case QuestionKind.Number:
      return numeric(question, raw, false);
    case QuestionKind.Money:
      return numeric(question, raw, true);
    case QuestionKind.Boolean:
      return typeof raw === 'boolean' ? { ok: true, value: raw } : fail('must be true or false');
    case QuestionKind.Date:
      return typeof raw === 'string' && isValidDate(raw) ? { ok: true, value: raw } : fail('must be a date in YYYY-MM-DD format');
    case QuestionKind.Text:
      return text(question, raw);
    case QuestionKind.City:
      return typeof raw === 'string' && UUID_PATTERN.test(raw) ? { ok: true, value: raw.toLowerCase() } : fail('must be a city id from the city search');
    case QuestionKind.Pincode:
      return typeof raw === 'string' && PINCODE_PATTERN.test(raw.trim()) ? { ok: true, value: raw.trim() } : fail('must be a 6-digit pincode');
    default:
      return assertNever(question.kind);
  }
}
