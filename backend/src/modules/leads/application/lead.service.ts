import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ContactType, LeadEventType, type LeadConsentStatus, type LeadFlag, type LeadLostReason, LeadStatus, LeadUnqualifiedReason, type LeadUrgency } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { paiseFromNumber } from '../../../common/money/paise.js';
import { LeadEvent, leadMachine, OPEN_LEAD_STATES } from '../../../engines/state-machines/machines/lead.machine.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadConsentPolicy } from './lead-consent.policy.js';
import { LeadLocator } from './lead-locator.service.js';
import { scoreFor } from './lead-scoring.js';
import { LeadTimeline } from './lead-timeline.service.js';
import { toLeadDetailView, toLeadView } from './lead.views.js';

export type LeadFilters = PageQuery & {
  status?: LeadStatus[];
  source?: string;
  consentStatus?: LeadConsentStatus;
  flag?: LeadFlag;
  segment?: string;
  category?: string;
  cityId?: string;
  pincode?: string;
  q?: string;
  createdFrom?: Date;
  createdTo?: Date;
};

export type LeadPatch = {
  segment?: string | null;
  subSegment?: string | null;
  category?: string | null;
  purpose?: string | null;
  purposeNote?: string | null;
  amountMinPaise?: number | null;
  amountMaxPaise?: number | null;
  tenureMonths?: number | null;
  cityId?: string | null;
  pincode?: string | null;
  urgency?: LeadUrgency | null;
  preferredLanguage?: string | null;
  preferredContactTime?: string | null;
  campaign?: string | null;
  flags?: LeadFlag[];
};

export type LeadAction =
  | { event: typeof LeadEvent.Qualify | typeof LeadEvent.Reopen | typeof LeadEvent.Recycle; note?: string }
  | { event: typeof LeadEvent.Hold; note?: string; holdUntil?: Date }
  | { event: typeof LeadEvent.Disqualify; reason: LeadUnqualifiedReason; note?: string }
  | { event: typeof LeadEvent.Lose; reason: LeadLostReason; note?: string };

const REF_PATTERN = /^LD-\d{2}-\d+$/i;

@Injectable()
export class LeadService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly parties: PartyService,
    private readonly catalog: CatalogQueryService,
    private readonly locator: LeadLocator,
    private readonly consentPolicy: LeadConsentPolicy,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(filters: LeadFilters) {
    const window = pageWindow(filters);
    const q = filters.q?.trim();
    const where: Prisma.LeadWhereInput = {
      id: window.idFilter,
      status: filters.status ? { in: filters.status } : undefined,
      source: filters.source ? { key: filters.source } : undefined,
      consentStatus: filters.consentStatus,
      flags: filters.flag ? { has: filters.flag } : undefined,
      segmentKey: filters.segment,
      categoryKey: filters.category,
      cityId: filters.cityId,
      pincode: filters.pincode,
      createdAt: filters.createdFrom || filters.createdTo ? { gte: filters.createdFrom, lt: filters.createdTo } : undefined,
      ...(q ? (REF_PATTERN.test(q) ? { ref: q.toUpperCase() } : { party: { displayName: { contains: q, mode: 'insensitive' } } }) : {}),
    };
    return toPage(await this.leads.list(where, window.take), filters.limit, toLeadView);
  }

  async get(id: string) {
    const lead = await this.require(id);
    return toLeadDetailView(lead, await this.parties.listContacts(lead.partyId, false));
  }

  @Transactional()
  async update(id: string, patch: LeadPatch, expectedVersion: number | undefined) {
    const lead = await this.require(id);
    assertVersion(expectedVersion, lead.version);
    const data: Prisma.LeadUncheckedUpdateManyInput = {};
    if (patch.segment !== undefined) data.segmentKey = await this.checkedKey('segment', patch.segment);
    if (patch.subSegment !== undefined) data.subSegmentKey = await this.checkedKey('subSegment', patch.subSegment);
    if (patch.category !== undefined) {
      const category = patch.category ? await this.catalog.resolveCategory(patch.category) : null;
      if (patch.category && !category) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'category', code: 'unknown_key', message: `unknown or inactive category ${patch.category}` }] });
      data.categoryKey = category?.key ?? null;
    }
    if (patch.purpose !== undefined) data.purposeKey = patch.purpose;
    if (patch.purposeNote !== undefined) data.purposeNote = patch.purposeNote;
    if (patch.amountMinPaise !== undefined) data.amountMinPaise = patch.amountMinPaise === null ? null : paiseFromNumber(patch.amountMinPaise);
    if (patch.amountMaxPaise !== undefined) data.amountMaxPaise = patch.amountMaxPaise === null ? null : paiseFromNumber(patch.amountMaxPaise);
    if (patch.tenureMonths !== undefined) data.tenureMonths = patch.tenureMonths;
    if (patch.cityId !== undefined || patch.pincode !== undefined) {
      const location = await this.locator.locate({ cityId: (patch.cityId === undefined ? lead.cityId : patch.cityId) ?? undefined, pincode: (patch.pincode === undefined ? lead.pincode : patch.pincode) ?? undefined });
      Object.assign(data, { cityId: location.cityId, stateId: location.stateId, pincode: location.pincode, locationText: location.cityId ? null : lead.locationText });
    }
    if (patch.urgency !== undefined) data.urgency = patch.urgency;
    if (patch.preferredLanguage !== undefined) data.preferredLanguage = patch.preferredLanguage;
    if (patch.preferredContactTime !== undefined) data.preferredContactTime = patch.preferredContactTime;
    if (patch.campaign !== undefined) data.campaign = patch.campaign;
    if (patch.flags !== undefined) data.flags = [...new Set(patch.flags)];
    const merged = { ...lead, ...data } as typeof lead;
    if (merged.amountMinPaise !== null && merged.amountMaxPaise !== null && merged.amountMinPaise > merged.amountMaxPaise) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'amountMinPaise', code: 'invalid_range', message: 'amountMinPaise must not exceed amountMaxPaise' }] });
    }
    data.qualityScore = scoreFor(merged, await this.presence(lead.partyId, lead.party.displayName));
    const result = await this.leads.updateVersioned(id, lead.version, data);
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: lead.version + 1 } });
    await this.timeline.record(id, LeadEventType.edited, { data: { fields: Object.keys(patch) } });
    await this.changes.record({ action: AuditAction.LeadUpdated, entityType: AuditEntity.Lead, entityId: id, event: EventName.LeadUpdated, metadata: { ref: lead.ref, fields: Object.keys(patch) }, payload: { leadId: id } });
    return this.get(id);
  }

  @Transactional()
  async act(id: string, action: LeadAction) {
    const lead = await this.require(id);
    const next = transitionOrThrow(leadMachine, lead.status, action.event);
    const reason = 'reason' in action ? action.reason : null;
    const data: Prisma.LeadUncheckedUpdateManyInput = {
      status: next,
      statusChangedAt: new Date(),
      statusNote: action.note ?? null,
      unqualifiedReason: action.event === LeadEvent.Disqualify ? action.reason : null,
      lostReason: action.event === LeadEvent.Lose ? action.reason : null,
      holdUntil: action.event === LeadEvent.Hold ? (action.holdUntil ?? null) : null,
    };
    if (action.event === LeadEvent.Recycle || action.event === LeadEvent.Reopen) data.consentStatus = await this.consentPolicy.statusFor(lead.partyId);
    const moved = await this.leads.updateFromStatus(id, lead.status, data);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.statusChanged(lead, next, reason, action.note ?? null);
    return this.get(id);
  }

  @Transactional()
  async merge(survivorId: string, leadIds: string[], note: string) {
    const survivor = await this.require(survivorId);
    const ids = [...new Set(leadIds)].filter((leadId) => leadId !== survivorId);
    const others = await this.leads.findMany(ids);
    const issues = ids.flatMap((leadId, index) => {
      const lead = others.find((candidate) => candidate.id === leadId);
      if (!lead) return [{ path: `leadIds.${index}`, code: 'not_found', message: 'lead not found' }];
      if (lead.partyId !== survivor.partyId) return [{ path: `leadIds.${index}`, code: 'different_party', message: 'only leads of the same person can be merged; merge the people first' }];
      if (!leadMachine.can(lead.status, LeadEvent.Disqualify)) return [{ path: `leadIds.${index}`, code: 'not_mergeable', message: `a ${lead.status} lead cannot be merged` }];
      return [];
    });
    if (issues.length > 0 || ids.length === 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues.length > 0 ? issues : [{ path: 'leadIds', code: 'too_small', message: 'name at least one other lead' }] });
    for (const lead of others) {
      const moved = await this.leads.updateFromStatus(lead.id, lead.status, {
        status: LeadStatus.unqualified,
        unqualifiedReason: LeadUnqualifiedReason.duplicate,
        statusNote: note,
        statusChangedAt: new Date(),
        mergedIntoLeadId: survivor.id,
      });
      if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { leadId: lead.id } });
      await this.timeline.record(lead.id, LeadEventType.merged, { fromStatus: lead.status, toStatus: LeadStatus.unqualified, reason: LeadUnqualifiedReason.duplicate, note, data: { into: survivor.id } });
    }
    await this.timeline.record(survivor.id, LeadEventType.merged, { note, data: { merged: others.map((lead) => lead.id) } });
    await this.changes.record({
      action: AuditAction.LeadMerged,
      entityType: AuditEntity.Lead,
      entityId: survivor.id,
      event: EventName.LeadMerged,
      metadata: { ref: survivor.ref, merged: others.map((lead) => lead.ref), note },
      payload: { leadId: survivor.id, mergedLeadIds: others.map((lead) => lead.id) },
    });
    return this.get(survivor.id);
  }

  @Transactional()
  async revealContacts(id: string, reason: string) {
    const lead = await this.require(id);
    const contacts = await this.parties.listContacts(lead.partyId, true);
    await this.timeline.record(id, LeadEventType.contact_revealed, { reason });
    await this.changes.record({
      action: AuditAction.LeadContactRevealed,
      entityType: AuditEntity.Lead,
      entityId: id,
      event: EventName.LeadContactRevealed,
      metadata: { ref: lead.ref, reason, contacts: contacts.length },
      payload: { leadId: id },
    });
    return { leadId: id, contacts };
  }

  private async statusChanged(lead: { id: string; ref: string; status: LeadStatus; partyId: string }, to: LeadStatus, reason: string | null, note: string | null) {
    await this.timeline.record(lead.id, LeadEventType.status_changed, { fromStatus: lead.status, toStatus: to, reason, note });
    await this.changes.record({
      action: AuditAction.LeadStatusChanged,
      entityType: AuditEntity.Lead,
      entityId: lead.id,
      event: EventName.LeadStatusChanged,
      metadata: { ref: lead.ref, from: lead.status, to, reason, note },
      payload: { leadId: lead.id, partyId: lead.partyId, from: lead.status, to, reason, open: OPEN_LEAD_STATES.includes(to) },
    });
  }

  private async presence(partyId: string, displayName: string | null) {
    const contacts = await this.parties.listContacts(partyId, false);
    return {
      hasMobile: contacts.some((contact) => contact.type === ContactType.mobile && !contact.invalid),
      hasEmail: contacts.some((contact) => contact.type === ContactType.email && !contact.invalid),
      hasName: Boolean(displayName),
    };
  }

  private async checkedKey(field: 'segment' | 'subSegment', key: string | null) {
    if (key === null) return null;
    const known = await this.catalog.referenceKeys();
    const set = field === 'segment' ? known.segments : known.subSegments;
    if (!set.has(key)) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: field, code: 'unknown_key', message: `unknown or inactive ${field} ${key}` }] });
    return key;
  }

  private async require(id: string) {
    const lead = await this.leads.findDetail(id);
    if (!lead) throw new AppError(ErrorCode.NOT_FOUND);
    return lead;
  }
}
