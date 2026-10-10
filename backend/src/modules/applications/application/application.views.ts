import { paiseToNumber } from '../../../common/money/paise.js';
import type { ApplicationEvent } from '../../../generated/prisma/client.js';
import type { ApplicationPartyRow, ApplicationRow } from '../infrastructure/application.repository.js';

export const toApplicationView = (application: ApplicationRow) => ({
  id: application.id,
  ref: application.ref,
  borrowerProfileId: application.borrowerProfileId,
  party: application.party,
  actingParty: application.actingParty,
  channel: application.channel,
  partnerOrganizationId: application.partnerOrganizationId,
  leadId: application.leadId,
  segmentKey: application.segmentKey,
  subSegmentKey: application.subSegmentKey,
  categoryKey: application.categoryKey,
  purposeKey: application.purposeKey,
  purposeNote: application.purposeNote,
  amountPaise: application.amountPaise === null ? null : paiseToNumber(application.amountPaise),
  tenureMonths: application.tenureMonths,
  location: { stateId: application.stateId, cityId: application.cityId, pincode: application.pincode },
  status: application.status,
  journeyStage: application.journeyStage,
  pinnedVersions: application.pinnedVersions,
  assessment: { scoreResultId: application.latestScoreResultId, scoredAt: application.scoredAt?.toISOString() ?? null },
  match: { matchRunId: application.latestMatchRunId, matchedAt: application.matchedAt?.toISOString() ?? null },
  closedAt: application.closedAt?.toISOString() ?? null,
  closeReason: application.closeReason,
  version: application.version,
  createdAt: application.createdAt.toISOString(),
  updatedAt: application.updatedAt.toISOString(),
});

export const toApplicationEventView = (event: ApplicationEvent) => ({
  id: event.id,
  type: event.type,
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  reason: event.reason,
  note: event.note,
  data: event.data,
  actorType: event.actorType,
  actorUserId: event.actorUserId,
  createdAt: event.createdAt.toISOString(),
});

export const toApplicationPartyView = (row: ApplicationPartyRow, mobile: string | null) => ({
  id: row.id,
  party: row.party,
  role: row.role,
  relationship: row.relationship,
  status: row.status,
  consentStatus: row.consentStatus,
  consentedAt: row.consentedAt?.toISOString() ?? null,
  mobile,
  createdAt: row.createdAt.toISOString(),
});
