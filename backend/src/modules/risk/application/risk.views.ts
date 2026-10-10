import type { FraudReview, RiskSignal } from '../../../generated/prisma/client.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toSignalView = (signal: RiskSignal) => ({
  id: signal.id,
  reviewId: signal.reviewId,
  kind: signal.kind,
  severity: signal.severity,
  source: signal.source,
  ruleKey: signal.ruleKey,
  subject: { type: signal.subjectType, id: signal.subjectId },
  partyId: signal.partyId,
  applicationId: signal.applicationId,
  organizationId: signal.organizationId,
  evidence: signal.evidence,
  status: signal.status,
  createdAt: signal.createdAt.toISOString(),
});

export const toReviewView = (review: FraudReview) => ({
  id: review.id,
  subject: { type: review.subjectType, id: review.subjectId },
  partyId: review.partyId,
  applicationId: review.applicationId,
  organizationId: review.organizationId,
  status: review.status,
  highestSeverity: review.highestSeverity,
  decision: review.decision,
  note: review.note,
  decidedByUserId: review.decidedByUserId,
  decidedAt: iso(review.decidedAt),
  version: review.version,
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
});
