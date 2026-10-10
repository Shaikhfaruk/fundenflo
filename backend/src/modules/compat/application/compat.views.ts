import { formatDisplayDate } from '../../../common/i18n/date-format.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { type DocumentRejectReason, DocumentRequestStatus, DocumentStatus, type SubmissionStatus } from '../../../common/enums/db.enums.js';
import { FactorStatus } from '../../../engines/scoring/scoring.types.js';
import type { AnalysisStepState } from '../../assessments/domain/assessment.constants.js';
import {
  COMPAT_ANALYSIS_FAILED_MESSAGE,
  COMPAT_ANALYSIS_STATUS,
  COMPAT_DOCUMENT_STATUS,
  COMPAT_FINAL_STATES,
  COMPAT_OPEN_STATUS,
  COMPAT_PENDING_DOCUMENT_DETAIL,
  COMPAT_REJECT_MESSAGES,
  COMPAT_STEP_STATE,
  COMPAT_TIMELINE,
  COMPAT_TIMELINE_REACHED,
  CompatAnalysisStatus,
  CompatDocumentStatus,
  CompatRejection,
  CompatTimelineStep,
  NATIONAL_MOBILE_PREFIX,
} from '../domain/compat.constants.js';

type DocumentLike = { status: DocumentStatus; rejectReason: DocumentRejectReason | null };

type AnalysisLike = { status: keyof typeof COMPAT_ANALYSIS_STATUS; steps: Array<{ id: string; label: string; state: AnalysisStepState }> };

type FactorLike = { id: string; label: string; score: number | null; max: number; attention?: boolean; status: string };

type ScoreLike = { analysisId: string | null; value: number | null; band: string | null; assessedAt: string; factors: FactorLike[] };

type ImprovementLike = { id: string; title: string; found: string; why: string; action: string; evidence: string };

type SubmissionLike = {
  ref: string;
  status: SubmissionStatus;
  matchResultId: string;
  lender: { name: string | null };
  product: { name: string };
  sentAt: string | null;
  sanction: { sanctionedAt: string | null } | null;
  disbursal: { disbursedAt: string | null };
  createdAt: string;
  documentRequests: Array<{ status: string; note: string | null; documentTypes: Array<{ label: string }> }>;
};

export const nationalMobile = (mobile: string | null) => (mobile ? mobile.replace(NATIONAL_MOBILE_PREFIX, '') : null);

export function toCompatDocumentStatus(document: DocumentLike) {
  const status = COMPAT_DOCUMENT_STATUS[document.status];
  if (status !== CompatDocumentStatus.Rejected) return { status };
  const reason = document.rejectReason ?? (document.status === DocumentStatus.expired ? CompatRejection.Expired : CompatRejection.Removed);
  return { status, reason: COMPAT_REJECT_MESSAGES[reason] };
}

export function toCompatAnalysis(analysis: AnalysisLike) {
  const status = COMPAT_ANALYSIS_STATUS[analysis.status];
  return {
    status,
    steps: analysis.steps.map((step) => ({ id: step.id, label: step.label, state: status === CompatAnalysisStatus.Done ? 'done' : COMPAT_STEP_STATE[step.state] })),
    ...(status === CompatAnalysisStatus.Failed ? { message: COMPAT_ANALYSIS_FAILED_MESSAGE } : {}),
  };
}

export function basedOnText(titles: string[]) {
  if (titles.length === 0) return 'Based On The Documents You Uploaded.';
  const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(', ')} And ${titles.at(-1)}`;
  return `Based On Your ${list}.`;
}

export const toCompatAssessment = (score: ScoreLike, improvement: ImprovementLike[], basedOn: string) => ({
  score: {
    analysisId: score.analysisId,
    value: score.value ?? 0,
    band: score.band ?? '',
    assessedAt: score.assessedAt,
    factors: score.factors.filter((factor) => factor.status === FactorStatus.Scored).map((factor) => ({ id: factor.id, label: factor.label, score: factor.score ?? 0, max: factor.max, ...(factor.attention ? { attention: true } : {}) })),
    basedOn,
  },
  improvement: improvement.map((item) => ({ id: item.id, title: item.title, found: item.found, why: item.why, action: item.action, evidence: item.evidence })),
});

function stepTime(step: CompatTimelineStep, submission: SubmissionLike, locale: Locale) {
  const at = { documents: submission.createdAt, sent: submission.sentAt, review: null, sanctioned: submission.sanction?.sanctionedAt ?? null, disbursed: submission.disbursal.disbursedAt }[step];
  return at ? formatDisplayDate(new Date(at), locale) : undefined;
}

export function toCompatApplication(submission: SubmissionLike, amountRupees: number | null, locale: Locale) {
  const reached = COMPAT_TIMELINE_REACHED[submission.status];
  const closed = COMPAT_FINAL_STATES.has(submission.status);
  const pending = submission.documentRequests.find((request) => request.status === DocumentRequestStatus.open);
  return {
    id: submission.ref,
    lenderId: submission.matchResultId,
    lenderName: submission.lender.name ?? '',
    product: submission.product.name,
    amount: amountRupees,
    status: closed ? submission.status : COMPAT_OPEN_STATUS,
    createdAt: submission.createdAt,
    timeline: COMPAT_TIMELINE.map((step, index) => {
      const state = index < reached ? 'done' : index === reached && !closed ? 'active' : 'pending';
      const at = state === 'done' ? stepTime(step.id, submission, locale) : undefined;
      return { id: step.id, title: step.title, detail: step.detail, state, ...(at ? { at } : {}) };
    }),
    ...(pending ? { pendingDocument: { title: pending.documentTypes.map((type) => type.label).join(', '), detail: pending.note ?? COMPAT_PENDING_DOCUMENT_DETAIL } } : {}),
  };
}
