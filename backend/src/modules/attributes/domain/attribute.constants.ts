import { FactProvenance } from '../../../common/enums/db.enums.js';

export const PROVENANCE_RANK: Record<FactProvenance, number> = {
  [FactProvenance.ops_verified]: 5,
  [FactProvenance.third_party_verified]: 4,
  [FactProvenance.extracted]: 3,
  [FactProvenance.derived]: 2,
  [FactProvenance.declared]: 1,
};

export const FactSourceType = {
  QuestionAnswer: 'question_answer',
  LeadCapture: 'lead_capture',
  Import: 'import',
  OpsEntry: 'ops_entry',
  Integration: 'integration',
} as const;

export type FactSourceType = (typeof FactSourceType)[keyof typeof FactSourceType];

export const AttributeCacheTag = 'attributes';

export const ATTRIBUTE_CACHE_TTL_SECONDS = 300;

export const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const MAX_FACTS_PER_WRITE = 100;

export const STRING_FACT_MAX_LENGTH = 2_000;

export const MAX_ENUM_VALUES = 200;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
