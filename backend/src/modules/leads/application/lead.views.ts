import { paiseToNumber } from '../../../common/money/paise.js';
import type { LeadSource } from '../../../generated/prisma/client.js';
import type { LeadDetailRow, LeadListRow } from '../infrastructure/lead.repository.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

const paise = (value: bigint | null) => (value === null ? null : paiseToNumber(value));

export const toLeadSourceView = (source: LeadSource) => ({
  id: source.id,
  key: source.key,
  name: source.name,
  kind: source.kind,
  status: source.status,
  questionSetStage: source.questionSetStage,
  consentContext: source.consentContext,
  defaultLawfulBasis: source.defaultLawfulBasis,
  version: source.version,
  updatedAt: source.updatedAt.toISOString(),
});

export type LeadSourceView = ReturnType<typeof toLeadSourceView>;

export const toLeadView = (lead: LeadListRow) => ({
  id: lead.id,
  ref: lead.ref,
  status: lead.status,
  unqualifiedReason: lead.unqualifiedReason,
  lostReason: lead.lostReason,
  statusNote: lead.statusNote,
  statusChangedAt: lead.statusChangedAt.toISOString(),
  holdUntil: iso(lead.holdUntil),
  party: lead.party,
  business: lead.businessParty,
  source: lead.source,
  campaign: lead.campaign,
  segmentKey: lead.segmentKey,
  subSegmentKey: lead.subSegmentKey,
  categoryKey: lead.categoryKey,
  purposeKey: lead.purposeKey,
  purposeNote: lead.purposeNote,
  amount: { minPaise: paise(lead.amountMinPaise), maxPaise: paise(lead.amountMaxPaise), text: lead.amountText },
  tenureMonths: lead.tenureMonths,
  location: { state: lead.state, city: lead.city, pincode: lead.pincode, text: lead.locationText },
  urgency: lead.urgency,
  preferredLanguage: lead.preferredLanguage,
  preferredContactTime: lead.preferredContactTime,
  qualityScore: lead.qualityScore,
  flags: lead.flags,
  consentStatus: lead.consentStatus,
  lawfulBasis: lead.lawfulBasis,
  duplicateOfLeadId: lead.duplicateOfLeadId,
  mergedIntoLeadId: lead.mergedIntoLeadId,
  importBatchId: lead.importBatchId,
  importRowNumber: lead.importRowNumber,
  convertedApplicationId: lead.convertedApplicationId,
  version: lead.version,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
});

type ContactView = { type: string; masked: string; primary: boolean; verified: boolean; doNotContact: boolean; invalid: boolean };

export const toLeadDetailView = (lead: LeadDetailRow, contacts: ContactView[]) => ({
  ...toLeadView(lead),
  externalRef: lead.externalRef,
  utm: lead.utm,
  consentEvidence: lead.consentEvidence,
  capturedByUserId: lead.capturedByUserId,
  apiClientId: lead.apiClientId,
  contacts: contacts.map(({ type, masked, primary, verified, doNotContact, invalid }) => ({ type, masked, primary, verified, doNotContact, invalid })),
  assignments: lead.assignments.map((assignment) => ({
    id: assignment.id,
    organization: assignment.organization,
    status: assignment.status,
    strategy: assignment.strategy,
    routingRuleVersionId: assignment.routingRuleVersionId,
    offeredAt: assignment.offeredAt.toISOString(),
    respondBy: iso(assignment.respondBy),
    acceptedAt: iso(assignment.acceptedAt),
    closedAt: iso(assignment.closedAt),
    reason: assignment.reason,
  })),
  events: lead.events.map((event) => ({
    id: event.id,
    type: event.type,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    note: event.note,
    actorType: event.actorType,
    actorUserId: event.actorUserId,
    data: event.data,
    createdAt: event.createdAt.toISOString(),
  })),
});
