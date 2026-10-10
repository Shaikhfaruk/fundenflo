import { type Locale, localise } from '../../../common/i18n/locale.js';
import type { Analysis, ImprovementItem, ScoreResult } from '../../../generated/prisma/client.js';
import type { FactorResult } from '../../../engines/scoring/scoring.types.js';
import { ANALYSIS_STEP_LABELS, type AnalysisStepKey, type AnalysisStepState } from '../domain/assessment.constants.js';

export type AnalysisStep = { key: AnalysisStepKey; state: AnalysisStepState; detail: Record<string, unknown> | null };

export const toAnalysisView = (analysis: Analysis, locale: Locale) => ({
  id: analysis.id,
  applicationId: analysis.applicationId,
  status: analysis.status,
  steps: (analysis.steps as AnalysisStep[]).map((step) => ({ id: step.key, label: localise(ANALYSIS_STEP_LABELS[step.key], locale), state: step.state, detail: step.detail })),
  documentIds: analysis.documentIds,
  scoreResultId: analysis.scoreResultId,
  failureReason: analysis.failureReason,
  createdAt: analysis.createdAt.toISOString(),
  startedAt: analysis.startedAt?.toISOString() ?? null,
  finishedAt: analysis.finishedAt?.toISOString() ?? null,
});

type ScoreWithItems = ScoreResult & { items: ImprovementItem[]; analysis: { id: string; documentIds: string[] } | null };

export const toAssessmentView = (result: ScoreWithItems, locale: Locale) => ({
  score: {
    id: result.id,
    analysisId: result.analysis?.id ?? null,
    status: result.status,
    value: result.value,
    band: result.band ? localise(result.band, locale) : null,
    assessedAt: result.createdAt.toISOString(),
    factors: (result.factors as FactorResult[]).map((factor) => ({ id: factor.key, label: localise(factor.label, locale), score: factor.score, max: factor.max, attention: factor.attention, status: factor.status })),
    limitations: result.limitations,
    basedOn: { documents: result.analysis?.documentIds.length ?? 0, facts: Object.values(result.inputs as Record<string, unknown>).filter((value) => value !== null).length },
    model: { key: result.modelKey, number: result.modelNumber },
  },
  improvement: result.items.map((item) => ({
    id: item.id,
    rule: item.ruleKey,
    priority: item.priority,
    title: localise(item.title, locale),
    found: localise(item.found, locale),
    why: localise(item.why, locale),
    action: localise(item.action, locale),
    evidence: localise(item.evidence, locale),
    evidenceDocumentType: item.evidenceDocumentType,
  })),
});
