import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ActivityEntityType, ActivityOutcome, AssignmentStatus, ContactType, type FollowUpStatus, LeadEventType, LeadFlag, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { PageQuery } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { ActivityService } from '../../activities/application/activity.service.js';
import { CONTACT_ACTIVITY_TYPES } from '../../activities/domain/activity.constants.js';
import type { ActivityActor, ActivityInput } from '../../activities/domain/activity.types.js';
import { PartyService } from '../../parties/application/party.service.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadAssignmentService } from './lead-assignment.service.js';
import { LeadTimeline } from './lead-timeline.service.js';

type WorkedAssignment = { id: string; leadId: string; organizationId: string; status: AssignmentStatus; firstContactedAt: Date | null };

export type FollowUpRequest = { dueAt: Date; note: string; assigneeMembershipId?: string };

const HELD: readonly AssignmentStatus[] = [AssignmentStatus.accepted, AssignmentStatus.working, AssignmentStatus.completed];

const leadEntity = (id: string) => ({ type: ActivityEntityType.lead, id });

@Injectable()
export class LeadActivityService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly activities: ActivityService,
    private readonly assignments: LeadAssignmentService,
    private readonly parties: PartyService,
    private readonly memberships: MembershipService,
    private readonly timeline: LeadTimeline,
  ) {}

  list(leadId: string, scope: Prisma.ActivityWhereInput, query: PageQuery) {
    return this.activities.list(leadEntity(leadId), scope, query);
  }

  @Transactional()
  async record(leadId: string, input: ActivityInput, actor: ActivityActor, assignment?: WorkedAssignment) {
    const lead = await this.requireLead(leadId);
    if (input.contactId) await this.parties.requireContact(lead.partyId, input.contactId);
    const activity = await this.activities.log(leadEntity(lead.id), input, actor);
    let contactInvalidated = false;
    if (input.outcome === ActivityOutcome.wrong_number && input.contactId) {
      contactInvalidated = await this.parties.markContactInvalid(lead.partyId, input.contactId);
      if (contactInvalidated && !(await this.parties.hasUsableContact(lead.partyId, ContactType.mobile))) await this.leads.addFlag(lead.id, LeadFlag.invalid_number);
    }
    let firstContact = false;
    if (assignment) {
      const status = await this.assignments.startWork(assignment);
      if (CONTACT_ACTIVITY_TYPES.includes(input.type)) firstContact = await this.assignments.recordFirstContact({ ...assignment, status }, new Date(activity.occurredAt));
    }
    await this.timeline.record(lead.id, LeadEventType.activity_logged, {
      data: { activityId: activity.id, type: activity.type, outcome: activity.outcome, organizationId: activity.organizationId, firstContact, contactInvalidated },
    });
    return activity;
  }

  @Transactional()
  async createFollowUp(leadId: string, request: FollowUpRequest, actor: ActivityActor) {
    await this.requireLead(leadId);
    const assignee = request.assigneeMembershipId && actor.organizationId ? await this.memberships.requireActiveMember(actor.organizationId, request.assigneeMembershipId, SessionContext.partner) : null;
    return this.activities.createFollowUp(
      leadEntity(leadId),
      {
        dueAt: request.dueAt,
        note: request.note,
        assigneeUserId: assignee?.userId ?? actor.userId,
        assigneeMembershipId: assignee?.id ?? actor.membershipId,
        organizationId: actor.organizationId,
      },
      actor.userId,
    );
  }

  async listFollowUps(scope: Prisma.FollowUpWhereInput, filters: { status?: FollowUpStatus; dueBefore?: Date }, limit: number, organizationId: string | null) {
    const items = await this.activities.listFollowUps({ AND: [scope, { entityType: ActivityEntityType.lead }] }, filters, limit);
    const leadIds = [...new Set(items.map((item) => item.entityId))];
    if (leadIds.length === 0) return { items: [] };
    const [summaries, held] = await Promise.all([this.leads.findSummaries(leadIds), organizationId ? this.leads.heldLeadIds(leadIds, organizationId, HELD) : Promise.resolve(null)]);
    const visible = held ? new Set(held.map((row) => row.leadId)) : null;
    const byId = new Map(summaries.map((lead) => [lead.id, lead]));
    return {
      items: items.map((item) => {
        const lead = byId.get(item.entityId);
        return { ...item, lead: lead ? { id: lead.id, ref: lead.ref, status: lead.status, name: !visible || visible.has(lead.id) ? lead.party.displayName : null } : null };
      }),
    };
  }

  private async requireLead(id: string) {
    const [lead] = await this.leads.findMany([id]);
    if (!lead) throw new AppError(ErrorCode.NOT_FOUND);
    return lead;
  }
}
