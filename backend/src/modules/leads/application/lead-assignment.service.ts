import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { HOUR_MS } from '../../../common/constants/time.constants.js';
import { AssignmentStatus, LeadConsentStatus, LeadEventType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { ACTIVE_ASSIGNMENT_STATES, AssignmentEvent, assignmentMachine } from '../../../engines/state-machines/machines/assignment.machine.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { AssignmentCloseReason } from '../domain/lead-routing.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadRoutingQueue } from '../infrastructure/lead-routing.queue.js';
import { LeadTimeline } from './lead-timeline.service.js';

type AssignmentRef = { id: string; leadId: string; organizationId: string; status: AssignmentStatus };

export type OfferTerms = {
  strategy: string;
  routingRuleVersionId: string | null;
  acceptHours: number;
  firstContactHours: number;
  assignedByUserId?: string;
  note?: string;
};

type Change = { action: AuditAction; event: EventName };

const CHANGES: Partial<Record<AssignmentEvent, Change>> = {
  [AssignmentEvent.Accept]: { action: AuditAction.AssignmentAccepted, event: EventName.AssignmentAccepted },
  [AssignmentEvent.Complete]: { action: AuditAction.AssignmentCompleted, event: EventName.AssignmentCompleted },
  [AssignmentEvent.Decline]: { action: AuditAction.AssignmentDeclined, event: EventName.AssignmentDeclined },
  [AssignmentEvent.Expire]: { action: AuditAction.AssignmentExpired, event: EventName.AssignmentExpired },
  [AssignmentEvent.Revoke]: { action: AuditAction.AssignmentRevoked, event: EventName.AssignmentRevoked },
  [AssignmentEvent.Return]: { action: AuditAction.AssignmentReturned, event: EventName.AssignmentReturned },
};

const CLOSING: ReadonlySet<AssignmentEvent> = new Set([AssignmentEvent.Complete, AssignmentEvent.Decline, AssignmentEvent.Expire, AssignmentEvent.Revoke, AssignmentEvent.Return]);

@Injectable()
export class LeadAssignmentService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
    private readonly queue: LeadRoutingQueue,
    private readonly consents: ConsentService,
  ) {}

  async offer(lead: { id: string; ref: string }, organizationId: string, terms: OfferTerms) {
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
    await this.queue.scheduleExpiry(assignment.id, terms.acceptHours * HOUR_MS);
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

  accept(assignment: AssignmentRef, assigneeMembershipId: string | null) {
    return this.transition(assignment, AssignmentEvent.Accept, { data: { acceptedAt: new Date(), assigneeMembershipId } });
  }

  async startWork(assignment: AssignmentRef) {
    if (assignment.status !== AssignmentStatus.accepted) return assignment.status;
    return this.transition(assignment, AssignmentEvent.StartWork, {});
  }

  decline(assignment: AssignmentRef, reason: string, note: string | null) {
    return this.transition(assignment, AssignmentEvent.Decline, { reason, note });
  }

  giveBack(assignment: AssignmentRef, reason: string, note: string | null) {
    return this.transition(assignment, AssignmentEvent.Return, { reason, note });
  }

  revoke(assignment: AssignmentRef, reason: string, note: string | null = null) {
    return this.transition(assignment, AssignmentEvent.Revoke, { reason, note });
  }

  complete(assignment: AssignmentRef, reason: string, note: string | null) {
    return this.transition(assignment, AssignmentEvent.Complete, { reason, note });
  }

  @Transactional()
  async expire(assignmentId: string, now = new Date()) {
    const assignment = await this.leads.findAssignment(assignmentId);
    if (assignment?.status !== AssignmentStatus.offered || !assignment.respondBy || assignment.respondBy > now) return false;
    await this.transition(assignment, AssignmentEvent.Expire, { reason: AssignmentCloseReason.AcceptDeadlineMissed });
    return true;
  }

  async subAssign(assignment: AssignmentRef & { assigneeMembershipId: string | null }, membershipId: string) {
    if (!ACTIVE_ASSIGNMENT_STATES.includes(assignment.status) || assignment.status === AssignmentStatus.offered) {
      throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: assignment.status, event: 'sub_assign', allowed: [] } });
    }
    const moved = await this.leads.updateAssignmentFromStatus(assignment.id, assignment.status, { assigneeMembershipId: membershipId });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.timeline.record(assignment.leadId, LeadEventType.assignment_changed, { reason: 'sub_assigned', data: { assignmentId: assignment.id, organizationId: assignment.organizationId, from: assignment.assigneeMembershipId, to: membershipId } });
    await this.changes.record({
      action: AuditAction.AssignmentReassigned,
      entityType: AuditEntity.LeadAssignment,
      entityId: assignment.id,
      event: EventName.AssignmentReassigned,
      metadata: { leadId: assignment.leadId, organizationId: assignment.organizationId, from: assignment.assigneeMembershipId, to: membershipId },
      payload: { assignmentId: assignment.id, leadId: assignment.leadId, organizationId: assignment.organizationId, assigneeMembershipId: membershipId },
    });
  }

  async closeActive(leadId: string, reason: string, options: { exceptId?: string; statuses?: readonly AssignmentStatus[] } = {}) {
    const statuses = options.statuses ?? ACTIVE_ASSIGNMENT_STATES;
    const open = (await this.leads.assignmentsForLead(leadId)).filter((assignment) => statuses.includes(assignment.status) && assignment.id !== options.exceptId);
    for (const assignment of open) await this.revoke(assignment, reason);
    return open.length;
  }

  async enforceConsent(partyId: string): Promise<string[]> {
    const active = await this.leads.activeAssignmentsForParty(partyId, ACTIVE_ASSIGNMENT_STATES);
    if (active.length === 0) return [];
    const allowed = await this.consents.allowedOrganizations(partyId, ConsentPurposeKey.PartnerSharing, [...new Set(active.map((assignment) => assignment.organizationId))]);
    const revoked = active.filter((assignment) => assignment.lead.consentStatus !== LeadConsentStatus.ok || !allowed.has(assignment.organizationId));
    for (const assignment of revoked) await this.revoke(assignment, AssignmentCloseReason.ConsentWithdrawn);
    return [...new Set(revoked.map((assignment) => assignment.leadId))];
  }

  private async transition(assignment: AssignmentRef, event: AssignmentEvent, options: { data?: Prisma.LeadAssignmentUncheckedUpdateManyInput; reason?: string; note?: string | null }) {
    const next = transitionOrThrow(assignmentMachine, assignment.status, event);
    const closing = CLOSING.has(event);
    const moved = await this.leads.updateAssignmentFromStatus(assignment.id, assignment.status, { ...options.data, status: next, ...(closing ? { closedAt: new Date(), reason: options.reason ?? null } : {}) });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    const change = CHANGES[event];
    const details = { assignmentId: assignment.id, leadId: assignment.leadId, organizationId: assignment.organizationId, from: assignment.status, to: next, reason: options.reason ?? null };
    await this.timeline.record(assignment.leadId, LeadEventType.assignment_changed, { reason: options.reason ?? event, note: options.note ?? null, data: details });
    if (change) await this.changes.record({ action: change.action, entityType: AuditEntity.LeadAssignment, entityId: assignment.id, event: change.event, metadata: details, payload: details });
    return next;
  }
}
