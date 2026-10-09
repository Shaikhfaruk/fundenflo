import { LeadEventType, LeadFlag } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import type { SlaTimer } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { SlaHandlerFor } from '../../sla/application/sla-handler.registry.js';
import type { SlaHandler } from '../../sla/domain/sla.types.js';
import { LeadSlaKind } from '../domain/lead-routing.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadAssignmentService } from './lead-assignment.service.js';
import { LeadTimeline } from './lead-timeline.service.js';

@SlaHandlerFor(LeadSlaKind.AssignmentAccept)
export class AssignmentAcceptSlaHandler implements SlaHandler {
  constructor(private readonly assignments: LeadAssignmentService) {}

  async breach(timer: SlaTimer) {
    await this.assignments.expire(timer.entityId, timer.breachedAt ?? timer.dueAt);
  }
}

@SlaHandlerFor(LeadSlaKind.AssignmentFirstContact)
export class AssignmentFirstContactSlaHandler implements SlaHandler {
  constructor(
    private readonly leads: LeadRepository,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  async warn(timer: SlaTimer) {
    await this.record(timer, LeadEventType.sla_warned, AuditAction.LeadSlaWarned, EventName.LeadSlaWarned);
  }

  async breach(timer: SlaTimer) {
    const assignment = await this.record(timer, LeadEventType.sla_breached, AuditAction.LeadSlaBreached, EventName.LeadSlaBreached);
    if (assignment) await this.leads.addFlag(assignment.leadId, LeadFlag.first_contact_missed);
  }

  private async record(timer: SlaTimer, type: LeadEventType, action: AuditAction, event: EventName) {
    const assignment = await this.leads.findAssignment(timer.entityId);
    if (!assignment) return null;
    const details = { kind: timer.kind, timerId: timer.id, assignmentId: assignment.id, leadId: assignment.leadId, organizationId: assignment.organizationId, assigneeMembershipId: assignment.assigneeMembershipId, dueAt: timer.dueAt.toISOString() };
    await this.timeline.record(assignment.leadId, type, { reason: timer.kind, data: details });
    await this.changes.record({ action, entityType: AuditEntity.LeadAssignment, entityId: assignment.id, event, metadata: details, payload: details });
    return assignment;
  }
}
