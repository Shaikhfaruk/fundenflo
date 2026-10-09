import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AssignmentStatus, type LeadLostReason, LeadConsentStatus, LeadStatus, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { LeadEvent } from '../../../engines/state-machines/machines/lead.machine.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { AssignmentCloseReason, PartnerInboxView } from '../domain/lead-routing.constants.js';
import { LeadRepository, type PartnerAssignmentRow } from '../infrastructure/lead.repository.js';
import { LeadAssignmentService } from './lead-assignment.service.js';
import { LeadService } from './lead.service.js';
import { toPartnerLeadView } from './partner-lead.views.js';

const { offered, accepted, working, completed, declined, expired, revoked, returned } = AssignmentStatus;

const INBOX: Record<PartnerInboxView, AssignmentStatus[]> = {
  [PartnerInboxView.Offered]: [offered],
  [PartnerInboxView.Active]: [accepted, working],
  [PartnerInboxView.Closed]: [completed, declined, expired, revoked, returned],
};

const DEFAULT_INBOX: AssignmentStatus[] = [offered, accepted, working];

const VISIBLE: AssignmentStatus[] = [offered, accepted, working, completed];

const WORKABLE: readonly AssignmentStatus[] = [accepted, working];

const STARTABLE: readonly LeadStatus[] = [LeadStatus.new, LeadStatus.qualified];

@Injectable()
export class PartnerLeadService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly leadService: LeadService,
    private readonly assignments: LeadAssignmentService,
    private readonly consents: ConsentService,
    private readonly parties: PartyService,
    private readonly memberships: MembershipService,
  ) {}

  async inbox(ability: AppAbility, query: { view?: PartnerInboxView; cursor?: string; limit: number }) {
    const window = pageWindow(query);
    const where = { AND: [accessibleBy(ability, AppAction.Read).ofType('LeadAssignment'), { id: window.idFilter, status: { in: query.view ? INBOX[query.view] : DEFAULT_INBOX } }] };
    return toPage(await this.leads.listAssignments(where, window.take), query.limit, (row) => toPartnerLeadView(row));
  }

  async detail(leadId: string, ability: AppAbility) {
    const assignment = await this.current(leadId, ability, AppAction.Read);
    return this.view(assignment, ability);
  }

  @Transactional()
  async accept(leadId: string, actor: UserActor, ability: AppAbility) {
    await this.leads.lockLead(leadId);
    const assignment = await this.current(leadId, ability, AppAction.Update);
    if (assignment.status === offered && assignment.respondBy && assignment.respondBy <= new Date()) {
      throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: assignment.status, event: 'accept', reason: AssignmentCloseReason.AcceptDeadlineMissed } });
    }
    await this.assertShareable(assignment);
    await this.assignments.accept(assignment, actor.membershipId);
    await this.assignments.closeActive(leadId, AssignmentCloseReason.AcceptedByAnotherPartner, { exceptId: assignment.id, statuses: [offered] });
    if (STARTABLE.includes(assignment.lead.status)) await this.leadService.act(leadId, { event: LeadEvent.Start });
    return this.detail(leadId, ability);
  }

  @Transactional()
  async decline(leadId: string, reason: string, note: string | undefined, ability: AppAbility) {
    await this.leads.lockLead(leadId);
    const assignment = await this.current(leadId, ability, AppAction.Update);
    return { id: assignment.id, status: await this.assignments.decline(assignment, reason, note ?? null) };
  }

  @Transactional()
  async giveBack(leadId: string, reason: string, note: string | undefined, ability: AppAbility) {
    await this.leads.lockLead(leadId);
    const assignment = await this.current(leadId, ability, AppAction.Update);
    const status = await this.assignments.giveBack(assignment, reason, note ?? null);
    if (assignment.lead.status === LeadStatus.in_progress) await this.leadService.act(leadId, { event: LeadEvent.Recycle, note: note ?? reason });
    return { id: assignment.id, status };
  }

  @Transactional()
  async revealContacts(leadId: string, reason: string, ability: AppAbility) {
    const assignment = await this.workable(leadId, ability, 'reveal_contact');
    await this.assertShareable(assignment);
    await this.assignments.startWork(assignment);
    return this.leadService.revealContacts(leadId, reason, assignment);
  }

  @Transactional()
  async subAssign(leadId: string, membershipId: string, ability: AppAbility) {
    const assignment = await this.current(leadId, ability, AppAction.Assign);
    await this.memberships.requireActiveMember(assignment.organizationId, membershipId, SessionContext.partner);
    await this.assignments.subAssign(assignment, membershipId);
    return this.detail(leadId, ability);
  }

  @Transactional()
  async lose(leadId: string, reason: LeadLostReason, note: string | undefined, ability: AppAbility) {
    await this.leads.lockLead(leadId);
    const assignment = await this.workable(leadId, ability, 'lost');
    await this.assignments.complete(assignment, AssignmentCloseReason.LeadLost, note ?? null);
    await this.leadService.act(leadId, { event: LeadEvent.Lose, reason, note });
    return this.detail(leadId, ability);
  }

  private async view(assignment: PartnerAssignmentRow, ability: AppAbility) {
    const contacts = await this.parties.listContacts(assignment.lead.partyId, false);
    return { ...toPartnerLeadView(assignment, contacts), availableActions: this.actionsFor(assignment, ability) };
  }

  private actionsFor(assignment: PartnerAssignmentRow, ability: AppAbility): string[] {
    if (assignment.status === offered) return ['accept', 'decline'];
    if (!WORKABLE.includes(assignment.status)) return [];
    const actions = ['reveal_contact', 'return', 'lost'];
    return ability.can(AppAction.Assign, 'LeadAssignment') ? [...actions, 'sub_assign'] : actions;
  }

  private async workable(leadId: string, ability: AppAbility, event: string) {
    const assignment = await this.current(leadId, ability, AppAction.Update);
    if (!WORKABLE.includes(assignment.status)) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: assignment.status, event, allowed: [] } });
    return assignment;
  }

  private async current(leadId: string, ability: AppAbility, action: AppAction) {
    const assignment = await this.leads.findLatestAssignment({ AND: [accessibleBy(ability, action).ofType('LeadAssignment'), { leadId, status: { in: VISIBLE } }] });
    if (!assignment) throw new AppError(ErrorCode.NOT_FOUND);
    return assignment;
  }

  private async assertShareable(assignment: PartnerAssignmentRow) {
    const allowed = assignment.lead.consentStatus === LeadConsentStatus.ok && (await this.consents.allowedOrganizations(assignment.lead.partyId, ConsentPurposeKey.PartnerSharing, [assignment.organizationId])).has(assignment.organizationId);
    if (!allowed) throw new AppError(ErrorCode.CONSENT_REQUIRED, { details: { purpose: ConsentPurposeKey.PartnerSharing, organizationId: assignment.organizationId } });
  }
}
