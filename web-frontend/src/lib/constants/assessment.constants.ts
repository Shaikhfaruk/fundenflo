export const AnalysisStatus = { Queued: 'queued', Running: 'running', Done: 'done', Failed: 'failed' } as const;

export const OPEN_ANALYSIS_STATUSES: readonly string[] = [AnalysisStatus.Queued, AnalysisStatus.Running];

export const AnalysisStepState = { Pending: 'pending', Active: 'active', Done: 'done', Skipped: 'skipped', Failed: 'failed' } as const;

export const ScoreStatus = { Scored: 'scored', Insufficient: 'insufficient' } as const;

export const ANALYSIS_POLL_MS = 2_000;

export const SCORE_MAX = 100;

export const ANALYSIS_RUN_PARAM = 'run';
