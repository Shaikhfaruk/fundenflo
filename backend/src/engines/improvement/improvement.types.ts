import type { LocalisedText } from '../../common/i18n/locale.js';
import type { Condition } from '../conditions/condition.types.js';

export type ImprovementTexts = { title: LocalisedText; found: LocalisedText; why: LocalisedText; action: LocalisedText; evidence: LocalisedText };

export type CompiledImprovementRule = {
  scope: { segments: string[] };
  trigger: Condition;
  priority: number;
  texts: ImprovementTexts;
  evidenceDocumentType: string | null;
};

export const ScoreAttribute = {
  Value: 'score.value',
  factorPct: (key: string) => `factor.${key}.pct`,
  factorScore: (key: string) => `factor.${key}.score`,
  factorAttention: (key: string) => `factor.${key}.attention`,
} as const;

export const SCORE_ATTRIBUTE_PATTERN = /^(score\.value|factor\.[a-z][a-z0-9_]{0,39}\.(pct|score|attention))$/;
