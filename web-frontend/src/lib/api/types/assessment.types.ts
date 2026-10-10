export type AnalysisStep = { id: string; label: string; state: string; detail: Record<string, unknown> | null };

export type Analysis = {
  id: string;
  applicationId: string;
  status: string;
  steps: AnalysisStep[];
  documentIds: string[];
  scoreResultId: string | null;
  failureReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ScoreFactor = { id: string; label: string; score: number | null; max: number; attention: boolean; status: string };

type Score = {
  id: string;
  analysisId: string | null;
  status: string;
  value: number | null;
  band: string | null;
  assessedAt: string;
  factors: ScoreFactor[];
  limitations: Array<{ factor: string; reason: string }>;
  basedOn: { documents: number; facts: number };
  model: { key: string; number: number };
};

export type ImprovementItem = {
  id: string;
  rule: string;
  priority: number;
  title: string;
  found: string;
  why: string;
  action: string;
  evidence: string;
  evidenceDocumentType: string | null;
};

export type Assessment = { score: Score; improvement: ImprovementItem[] };
