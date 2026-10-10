import type { ConsentState } from './consent.types';
import type { ApplicationEvent, Application, ApplicationParty } from './application.types';
import type { DocumentChecklist, DocumentView } from './document.types';
import type { LenderSubmission, SubmissionDetail } from './submission.types';
import type { NextStep } from '../journey';

export type OpsCase = Application & { assessment: { scoreResultId: string | null; scoredAt: string | null }; match: { matchRunId: string | null; matchedAt: string | null }; assigneeUserId: string | null };

export type OpsCaseDetail = {
  application: OpsCase;
  parties: ApplicationParty[];
  documents: DocumentView[];
  checklist: DocumentChecklist;
  nextStep: NextStep;
  consents: ConsentState[];
  timeline: ApplicationEvent[];
};

export type OpsSubmission = LenderSubmission;

export type OpsSubmissionDetail = SubmissionDetail & {
  packet: { id: string; hash: string; createdAt: string; content: Record<string, unknown> } | null;
  documents: Array<{ id: string; documentType: string | { key: string; label?: unknown }; fileName?: string; status?: string }>;
};

type ExtractionField = { attributeKey: string; value: unknown; confidence: number | null; page: number | null };

export type DocumentExtraction = {
  id: string;
  extractor: string;
  model: string | null;
  promptVersion: string | null;
  status: string;
  classifiedAs: string | null;
  classConfidence: number | null;
  fields: ExtractionField[];
  reason: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
};

export type PartyFact = { factId: string; attributeKey: string; value: unknown; provenance: string; sourceType: string; sourceId: string | null; confidence: number | null; observedAt: string; stale: boolean };

export type PartyConsentRecord = {
  id: string;
  purpose: string;
  granted: boolean;
  basis: string;
  organizationIds: string[] | null;
  channel: string;
  evidence: string | null;
  capturedByUserId: string | null;
  recordedAt: string;
  expiresAt: string | null;
};

export type PartyAnswer = { id: string; questionKey: string; value: unknown; channel: string; answeredByUserId: string | null; applicationId: string | null; leadId: string | null; createdAt: string };

export type ConsistencySignal = {
  id: string;
  partyId: string;
  applicationId: string | null;
  attributeKey: string;
  declaredValue: unknown;
  observedValue: unknown;
  observedProvenance: string;
  deviationPct: number | null;
  severity: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
};

export type RiskSignal = {
  id: string;
  reviewId: string | null;
  kind: string;
  severity: string;
  source: string;
  ruleKey: string | null;
  subject: { type: string; id: string };
  partyId: string | null;
  applicationId: string | null;
  organizationId: string | null;
  evidence: Record<string, unknown> | null;
  status: string;
  createdAt: string;
};

export type FraudReview = {
  id: string;
  subject: { type: string; id: string };
  partyId: string | null;
  applicationId: string | null;
  organizationId: string | null;
  status: string;
  highestSeverity: string;
  decision: string | null;
  note: string | null;
  decidedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  signals?: RiskSignal[];
};

export type DataRequest = {
  id: string;
  ref: string;
  kind: string;
  status: string;
  details: string | null;
  dueAt: string;
  response: string | null;
  rejectedReason: string | null;
  exportReady: boolean;
  exportExpiresAt: string | null;
  completedAt: string | null;
  userId: string;
  partyId: string;
  outcome: unknown;
  version: number;
  createdAt: string;
  holds?: Array<{ kind?: string; reason?: string; [key: string]: unknown }>;
};

type PartySummary = {
  id: string;
  kind: string;
  displayName: string | null;
  status: string;
  mergedIntoId: string | null;
  hasLogin: boolean;
  organization: { id: string; name: string; type: string } | null;
  contacts: Array<{ type: string; masked: string; primary: boolean; verified: boolean }>;
  identifiers: Array<{ type: string; masked: string; verified: boolean }>;
  createdAt: string;
};

export type MatchReview = {
  id: string;
  partyId: string;
  candidatePartyIds: string[];
  signals: unknown;
  status: string;
  resolution: unknown;
  resolvedAt: string | null;
  createdAt: string;
  parties?: PartySummary[];
};

export type PartyMerge = { id: string; sourcePartyId: string; targetPartyId: string; reason: string; mergedAt: string; revertedAt: string | null };

export type AttributionDispute = {
  id: string;
  leadId: string;
  attribution: { id: string; organizationId: string; kind: string; protectedUntil: string };
  holderOrganizationId: string;
  claimantOrganizationId: string;
  source: string;
  claimNote: string | null;
  status: string;
  outcome: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  entityType: string;
  entityId: string;
  dueAt: string;
  overdue: boolean;
  note: string;
  status: string;
  doneAt: string | null;
  outcomeNote: string | null;
  version: number;
  createdAt: string;
};

export type OfflineConversion = {
  id: string;
  leadId: string;
  organizationId: string;
  lenderName: string;
  categoryKey: string | null;
  sanctionedAmountPaise: number;
  disbursedAmountPaise: number | null;
  sanctionedOn: string | null;
  disbursedOn: string | null;
  loanAccountRef: string | null;
  note: string | null;
  status: string;
  decisionNote: string | null;
  version: number;
  createdAt: string;
};

export type FunnelReport = { groupBy: string; from: string; to: string; total: number; items: Array<{ key: string | null; label: string | null; total: number; byStatus: Record<string, number>; byConsent: Record<string, number> }> };

export type PartnerPerformance = {
  from: string;
  to: string;
  items: Array<{
    organization: { id: string; name: string };
    offers: number;
    accepted: number;
    declined: number;
    expired: number;
    returned: number;
    acceptRate: number | null;
    medianAcceptMinutes: number | null;
    medianFirstContactMinutes: number | null;
    firstContactOnTimeRate: number | null;
    firstContactMissed: number;
    conversionsVerified: number;
    disbursedAmountPaise: number;
  }>;
};

export type LeadActivity = { id: string; type: string; outcome: string | null; body: string | null; durationSeconds: number | null; occurredAt: string; actorUserId: string | null; createdAt: string };

export type LeadContact = { id?: string; type: string; value?: string | null; masked: string; primary: boolean; verified: boolean; doNotContact: boolean; invalid: boolean };

export type LeadAssignment = {
  id: string;
  organization: { id: string; name: string } | null;
  status: string;
  strategy: string | null;
  offeredAt: string;
  respondBy: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  reason: string | null;
};

export type LeadEvent = { id: string; type: string; fromStatus: string | null; toStatus: string | null; reason: string | null; note: string | null; actorType: string; data: Record<string, unknown> | null; createdAt: string };
