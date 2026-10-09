import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { HOUR_MS } from '../../../common/constants/time.constants.js';
import { AssignmentStatus, ConfigResource, LeadConsentStatus, LeadEventType, LeadStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { AssignmentStrategy } from '../../../engines/assignment/assignment.types.js';
import { pickAssignees } from '../../../engines/assignment/pick-assignees.js';
import { type Condition, type FactLookup, type FactValue, Outcome } from '../../../engines/conditions/condition.types.js';
import { evaluateCondition } from '../../../engines/conditions/evaluate.js';
import { ACTIVE_ASSIGNMENT_STATES, AssignmentEvent, assignmentMachine } from '../../../engines/state-machines/machines/assignment.machine.js';
import { LeadEvent, leadMachine } from '../../../engines/state-machines/machines/lead.machine.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../../infrastructure/queue/queue-registry.service.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { PublishedConfig } from '../../config-publishing/domain/config.types.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { PartnerService } from '../../partners/application/partner.service.js';
import { DEFAULT_LEVEL_WEIGHTS, EXPIRE_OFFER_JOB, ROUTE_JOB, ROUTING_DEFAULTS, RoutingOutcome } from '../domain/lead-routing.constants.js';
import type { CompiledRoutingRule } from '../domain/routing-rule.schema.js';
import { type LeadDetailRow, LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadTimeline } from './lead-timeline.service.js';

const ROUTABLE: readonly LeadStatus[] = [LeadStatus.new, LeadStatus.qualified];

const CLOSED_FOR_LEAD: readonly AssignmentStatus[] = [AssignmentStatus.declined, AssignmentStatus.expired, AssignmentStatus.returned, AssignmentStatus.revoked];

const WORKED: readonly AssignmentStatus[] = [AssignmentStatus.accepted, AssignmentStatus.working, AssignmentStatus.completed];

type Rule = PublishedConfig<CompiledRoutingRule>;

export type RoutingResult = {
  outcome: RoutingOutcome;
  rule: { key: string; versionId: string } | null;
  candidates?: string[];
  assignments: Array<{ id: string; organizationId: string; respondBy: string | null }>;
};

const none = (outcome: RoutingOutcome, rule: Rule | null = null): RoutingResult => ({ outcome, rule: rule ? { key: rule.key, versionId: rule.versionId } : null, assignments: [] });

@Injectable()
export class LeadRoutingService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly config: ConfigPublishingService,
    private readonly facts: FactService,
    private readonly consents: ConsentService,
    private readonly partners: PartnerService,
    private readonly queues: QueueRegistry,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async route(leadId: string, options: { record: boolean; dryRun?: boolean } = { record: true }): Promise<RoutingResult> {
    const lead = await this.require(leadId);
    if (!ROUTABLE.includes(lead.status)) return none(RoutingOutcome.NotRoutable);
    const history = await this.leads.assignmentsForLead(lead.id);
    if (history.some((assignment) => ACTIVE_ASSIGNMENT_STATES.includes(assignment.status))) return none(RoutingOutcome.AlreadyAssigned);
    if (lead.consentStatus !== LeadConsentStatus.ok) return this.finish(lead, none(RoutingOutcome.ConsentPending), options);

    const rule = await this.matchingRule(lead);
    if (!rule) return this.finish(lead, none(RoutingOutcome.NoRule), options);
    if (rule.compiled.strategy === AssignmentStrategy.Manual || rule.compiled.strategy === AssignmentStrategy.Pool) return this.finish(lead, none(RoutingOutcome.ManualRule, rule), options);
    if (history.length >= rule.compiled.maxOffers) return this.finish(lead, none(RoutingOutcome.OfferLimitReached, rule), options);

    const pool = rule.compiled.pool;
    const partners = await this.partners.routingPool({
      kinds: pool.kinds,
      levels: pool.levels,
      organizationIds: pool.organizationIds,
      location: { stateId: lead.stateId, cityId: lead.cityId, pincode: lead.pincode },
      segment: lead.segmentKey,
      category: lead.categoryKey,
      language: lead.preferredLanguage,
      requireServiceArea: pool.requireServiceArea,
      requireCapabilities: pool.requireCapabilities,
      requireLanguage: pool.requireLanguage,
    });
    const organizationIds = partners.map((partner) => partner.organizationId);
    const consented = await this.consents.allowedOrganizations(lead.partyId, ConsentPurposeKey.PartnerSharing, organizationIds);
    const candidates = await this.candidates(lead, partners.filter((partner) => consented.has(partner.organizationId)), rule.compiled);
    const excluded = new Set(history.filter((assignment) => CLOSED_FOR_LEAD.includes(assignment.status)).map((assignment) => assignment.organizationId));
    const picked = pickAssignees({ strategy: rule.compiled.strategy, candidates, excluded, offers: rule.compiled.offers });
    if (picked.length === 0) return this.finish(lead, { ...none(RoutingOutcome.NoCandidate, rule), candidates: [] }, options);
    if (options.dryRun) return { outcome: RoutingOutcome.Offered, rule: { key: rule.key, versionId: rule.versionId }, candidates: picked, assignments: [] };

    const assignments = [];
    for (const organizationId of picked) {
      assignments.push(await this.offer(lead, organizationId, { strategy: rule.compiled.strategy, routingRuleVersionId: rule.versionId, acceptHours: rule.compiled.sla.acceptHours, firstContactHours: rule.compiled.sla.firstContactHours }));
    }
    return this.finish(lead, { outcome: RoutingOutcome.Offered, rule: { key: rule.key, versionId: rule.versionId }, candidates: picked, assignments }, options);
  }

  @Transactional()
  async assign(leadId: string, organizationId: string, note: string | undefined, assignedByUserId: string) {
    const lead = await this.require(leadId);
    if (!ROUTABLE.includes(lead.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: lead.status, event: 'assign' } });
    if ((await this.leads.assignmentsForLead(lead.id)).some((assignment) => ACTIVE_ASSIGNMENT_STATES.includes(assignment.status))) {
      throw new AppError(ErrorCode.CONFLICT, { details: { reason: 'the lead already has an active assignment; revoke it first' } });
    }
    if (lead.consentStatus !== LeadConsentStatus.ok || !(await this.consents.allowedOrganizations(lead.partyId, ConsentPurposeKey.PartnerSharing, [organizationId])).has(organizationId)) {
      throw new AppError(ErrorCode.CONSENT_REQUIRED, { details: { purpose: ConsentPurposeKey.PartnerSharing, organizationId } });
    }
    const [partner] = await this.partners.routingPool({ organizationIds: [organizationId], location: { stateId: null, cityId: null, pincode: null }, segment: null, category: null, language: null, requireServiceArea: false, requireCapabilities: false, requireLanguage: false });
    if (!partner) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'organizationId', code: 'partner_unavailable', message: 'not a verified, active and unpaused partner' }] });
    const assignment = await this.offer(lead, organizationId, { strategy: AssignmentStrategy.Manual, routingRuleVersionId: null, acceptHours: ROUTING_DEFAULTS.acceptHours, firstContactHours: ROUTING_DEFAULTS.firstContactHours, assignedByUserId, note });
    await this.timeline.record(lead.id, LeadEventType.routed, { note: note ?? null, data: { outcome: RoutingOutcome.Offered, manual: true, organizationId } });
    return assignment;
  }

  @Transactional()
  async revoke(assignmentId: string, reason: string) {
    const assignment = await this.requireAssignment(assignmentId);
    const next = transitionOrThrow(assignmentMachine, assignment.status, AssignmentEvent.Revoke);
    await this.closeAssignment(assignment.id, assignment.status, next, reason);
    if (assignment.lead.status === LeadStatus.in_progress) {
      await this.leads.updateFromStatus(assignment.lead.id, LeadStatus.in_progress, { status: transitionOrThrow(leadMachine, LeadStatus.in_progress, LeadEvent.Recycle), statusChangedAt: new Date(), statusNote: reason });
      await this.timeline.record(assignment.lead.id, LeadEventType.status_changed, { fromStatus: LeadStatus.in_progress, toStatus: LeadStatus.new, reason: 'assignment_revoked', note: reason });
    }
    await this.timeline.record(assignment.lead.id, LeadEventType.assignment_changed, { reason: 'revoked', note: reason, data: { assignmentId, organizationId: assignment.organizationId } });
    await this.changes.record({
      action: AuditAction.AssignmentRevoked,
      entityType: AuditEntity.LeadAssignment,
      entityId: assignment.id,
      event: EventName.AssignmentRevoked,
      metadata: { leadId: assignment.lead.id, organizationId: assignment.organizationId, reason },
      payload: { assignmentId, leadId: assignment.lead.id, organizationId: assignment.organizationId },
    });
    await this.enqueueRoute(assignment.lead.id);
    return { id: assignment.id, status: next };
  }

  @Transactional()
  async expire(assignmentId: string, now = new Date()) {
    const assignment = await this.leads.findAssignment(assignmentId);
    if (assignment?.status !== AssignmentStatus.offered || !assignment.respondBy || assignment.respondBy > now) return false;
    const next = transitionOrThrow(assignmentMachine, assignment.status, AssignmentEvent.Expire);
    await this.closeAssignment(assignment.id, assignment.status, next, 'accept_sla_missed');
    await this.timeline.record(assignment.lead.id, LeadEventType.assignment_changed, { reason: 'expired', data: { assignmentId, organizationId: assignment.organizationId } });
    await this.changes.record({
      action: AuditAction.AssignmentExpired,
      entityType: AuditEntity.LeadAssignment,
      entityId: assignment.id,
      event: EventName.AssignmentExpired,
      metadata: { leadId: assignment.lead.id, organizationId: assignment.organizationId },
      payload: { assignmentId, leadId: assignment.lead.id, organizationId: assignment.organizationId },
    });
    await this.enqueueRoute(assignment.lead.id);
    return true;
  }

  async enqueueRoute(leadId: string) {
    await this.queues.get(QueueName.LeadsRoute).add(ROUTE_JOB, { leadId }, { jobId: `route-${leadId}-${Date.now()}` });
  }

  private async offer(
    lead: LeadDetailRow,
    organizationId: string,
    terms: { strategy: string; routingRuleVersionId: string | null; acceptHours: number; firstContactHours: number; assignedByUserId?: string; note?: string },
  ) {
    const now = Date.now();
    const assignment = await this.leads.createAssignment({
      leadId: lead.id,
      organizationId,
      routingRuleVersionId: terms.routingRuleVersionId,
      strategy: terms.strategy,
      respondBy: new Date(now + terms.acceptHours * HOUR_MS),
      firstContactBy: new Date(now + (terms.acceptHours + terms.firstContactHours) * HOUR_MS),
      assignedByUserId: terms.assignedByUserId ?? null,
      note: terms.note ?? null,
    });
    await this.queues.get(QueueName.LeadsRoute).add(EXPIRE_OFFER_JOB, { assignmentId: assignment.id }, { jobId: `expire-${assignment.id}`, delay: terms.acceptHours * HOUR_MS });
    await this.changes.record({
      action: AuditAction.LeadAssigned,
      entityType: AuditEntity.LeadAssignment,
      entityId: assignment.id,
      event: EventName.AssignmentOffered,
      metadata: { leadId: lead.id, ref: lead.ref, organizationId, strategy: terms.strategy, routingRuleVersionId: terms.routingRuleVersionId },
      payload: { assignmentId: assignment.id, leadId: lead.id, organizationId, respondBy: assignment.respondBy?.toISOString() ?? null },
    });
    return { id: assignment.id, organizationId, organization: assignment.organization, status: assignment.status, respondBy: assignment.respondBy?.toISOString() ?? null };
  }

  private async matchingRule(lead: LeadDetailRow): Promise<Rule | null> {
    const rules = (await this.config.active<CompiledRoutingRule>(ConfigResource.routing_rule)).toSorted((left, right) => left.compiled.priority - right.compiled.priority || left.key.localeCompare(right.key));
    if (rules.length === 0) return null;
    const lookup = this.leadLookup(lead, await this.facts.lookup(lead.partyId));
    return rules.find((rule) => rule.compiled.when === undefined || evaluateCondition(rule.compiled.when as Condition, lookup).outcome === Outcome.Pass) ?? null;
  }

  private leadLookup(lead: LeadDetailRow, facts: FactLookup): FactLookup {
    const amount = lead.amountMinPaise === null && lead.amountMaxPaise === null ? undefined : { min: lead.amountMinPaise === null ? null : paiseToNumber(lead.amountMinPaise), max: lead.amountMaxPaise === null ? null : paiseToNumber(lead.amountMaxPaise) };
    const values: Record<string, FactValue | undefined> = {
      'lead.segment': lead.segmentKey ?? undefined,
      'lead.sub_segment': lead.subSegmentKey ?? undefined,
      'lead.category': lead.categoryKey ?? undefined,
      'lead.purpose': lead.purposeKey ?? undefined,
      'lead.state': lead.state?.gstCode,
      'lead.city_id': lead.cityId ?? undefined,
      'lead.pincode': lead.pincode ?? undefined,
      'lead.amount_paise': amount,
      'lead.tenure_months': lead.tenureMonths ?? undefined,
      'lead.source': lead.source.key,
      'lead.campaign': lead.campaign ?? undefined,
      'lead.language': lead.preferredLanguage ?? undefined,
      'lead.urgency': lead.urgency ?? undefined,
      'lead.quality_score': lead.qualityScore,
      'lead.flags': lead.flags,
    };
    return (attr) => (attr.startsWith('lead.') ? values[attr] : facts(attr));
  }

  private async candidates(lead: LeadDetailRow, partners: Array<{ organizationId: string; level: keyof typeof DEFAULT_LEVEL_WEIGHTS; maxOpenLeads: number | null }>, rule: CompiledRoutingRule) {
    const ids = partners.map((partner) => partner.organizationId);
    if (ids.length === 0) return [];
    const [open, last, worked] = await Promise.all([
      this.leads.openAssignmentCounts(ids, ACTIVE_ASSIGNMENT_STATES),
      this.leads.lastOffers(ids),
      this.leads.workedOrganizationsForParty(lead.partyId, WORKED),
    ]);
    const openBy = new Map(open.map((row) => [row.organizationId, row._count.organizationId]));
    const lastBy = new Map(last.map((row) => [row.organizationId, row._max.offeredAt]));
    const workedBy = new Set(worked.map((row) => row.organizationId));
    const weights = { ...DEFAULT_LEVEL_WEIGHTS, ...rule.weights };
    return partners.map((partner) => ({
      id: partner.organizationId,
      weight: weights[partner.level],
      openCount: openBy.get(partner.organizationId) ?? 0,
      capacity: partner.maxOpenLeads,
      lastAssignedAt: lastBy.get(partner.organizationId) ?? null,
      previouslyWorked: workedBy.has(partner.organizationId),
    }));
  }

  private async finish(lead: LeadDetailRow, result: RoutingResult, options: { record: boolean; dryRun?: boolean }) {
    if (!options.dryRun && (options.record || result.outcome === RoutingOutcome.Offered)) await this.timeline.record(lead.id, LeadEventType.routed, { data: { outcome: result.outcome, rule: result.rule?.key ?? null, organizations: result.assignments.map((assignment) => assignment.organizationId) } });
    return result;
  }

  private async closeAssignment(id: string, from: AssignmentStatus, to: AssignmentStatus, reason: string) {
    const moved = await this.leads.updateAssignmentFromStatus(id, from, { status: to, closedAt: new Date(), reason });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
  }

  private async requireAssignment(id: string) {
    const assignment = await this.leads.findAssignment(id);
    if (!assignment) throw new AppError(ErrorCode.NOT_FOUND);
    return assignment;
  }

  private async require(id: string) {
    const lead = await this.leads.findDetail(id);
    if (!lead) throw new AppError(ErrorCode.NOT_FOUND);
    return lead;
  }
}
