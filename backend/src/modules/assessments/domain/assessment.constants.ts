export const ASSESSMENT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export const SCORING_FACTORS_MAX = 20;

export const SCORING_BANDS_MAX = 10;

export const POINT_BANDS_MAX = 20;

export const DEFAULT_ATTENTION_BELOW_PCT = 60;

export const DEFAULT_IMPROVEMENT_PRIORITY = 50;

export const AnalysisStepKey = {
  Documents: 'documents',
  Consistency: 'consistency',
  Score: 'score',
} as const;

export type AnalysisStepKey = (typeof AnalysisStepKey)[keyof typeof AnalysisStepKey];

export const AnalysisStepState = {
  Pending: 'pending',
  Active: 'active',
  Done: 'done',
  Skipped: 'skipped',
  Failed: 'failed',
} as const;

export type AnalysisStepState = (typeof AnalysisStepState)[keyof typeof AnalysisStepState];

export const ANALYSIS_STEP_LABELS: Record<AnalysisStepKey, { en: string; hi: string }> = {
  [AnalysisStepKey.Documents]: { en: 'Reading Your Documents', hi: 'आपके दस्तावेज़ पढ़े जा रहे हैं' },
  [AnalysisStepKey.Consistency]: { en: 'Checking Your Figures Match', hi: 'आपके आंकड़ों का मिलान किया जा रहा है' },
  [AnalysisStepKey.Score]: { en: 'Calculating Your Financial Health Score', hi: 'आपका वित्तीय स्वास्थ्य स्कोर निकाला जा रहा है' },
};

export const AnalysisSkipReason = {
  NoScoringModel: 'no_scoring_model',
  Insufficient: 'insufficient_information',
} as const;

export const RecomputeMode = {
  Reproduce: 'reproduce',
  Current: 'current',
} as const;

export type RecomputeMode = (typeof RecomputeMode)[keyof typeof RecomputeMode];

export const SCORING_NEED_SOURCE_KEY = 'scoring_models';

export const SCORING_NEED_STAGES = ['pre_check', 'profile'] as const;

export const ANALYSIS_DOCUMENTS_MAX = 50;
