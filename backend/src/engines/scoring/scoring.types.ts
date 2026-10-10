import type { LocalisedText } from '../../common/i18n/locale.js';
import type { Condition, FactValue } from '../conditions/condition.types.js';

export const FactorMethod = {
  Bands: 'bands',
  Linear: 'linear',
} as const;

export type FactorMethod = (typeof FactorMethod)[keyof typeof FactorMethod];

export const MissingPolicy = {
  Insufficient: 'insufficient',
  ExcludeRenormalise: 'exclude_renormalise',
  Zero: 'zero',
} as const;

export type MissingPolicy = (typeof MissingPolicy)[keyof typeof MissingPolicy];

export const FactorStatus = {
  Scored: 'scored',
  Missing: 'missing',
  Excluded: 'excluded',
  ConsentMissing: 'consent_missing',
} as const;

export type FactorStatus = (typeof FactorStatus)[keyof typeof FactorStatus];

export const ScoreStatus = {
  Scored: 'scored',
  Insufficient: 'insufficient',
} as const;

export type ScoreStatus = (typeof ScoreStatus)[keyof typeof ScoreStatus];

export type PointsBand = { when: Condition; points: number };

export type LinearScale = { attr: string; from: number; to: number };

export type CompiledFactor = {
  key: string;
  label: LocalisedText;
  max: number;
  method: FactorMethod;
  bands: PointsBand[];
  linear: LinearScale | null;
  missing: MissingPolicy;
  requiresConsent: string | null;
  minRank: number | null;
};

export type ScoreBandLabel = { min: number; label: LocalisedText };

export type CompiledScoringModel = {
  scope: { segments: string[]; subSegments: string[] };
  factors: CompiledFactor[];
  attentionBelowPct: number;
  bands: ScoreBandLabel[];
};

export type FactorResult = { key: string; label: LocalisedText; score: number | null; max: number; attention: boolean; status: FactorStatus; inputs: string[] };

export type ScoreOutcome = {
  status: ScoreStatus;
  value: number | null;
  band: LocalisedText | null;
  factors: FactorResult[];
  limitations: Array<{ factor: string; reason: FactorStatus }>;
  inputs: Record<string, { value: FactValue; rank: number } | null>;
};
