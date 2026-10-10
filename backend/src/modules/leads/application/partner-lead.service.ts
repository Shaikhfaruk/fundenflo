import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AnswerChannel, AssignmentStatus, AttributionKind, ConsentChannel, DisputeSource, FollowUpStatus, OfflineConversionStatus, type LeadLostReason, LeadConsentStatus, LeadEventType, LeadStatus, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { EventName } from '../../../common/events/event-names.js';
import { DAY_MS } from '../../../common/constants/time.constants.js';
import { startOfDisplayDay, startOfDisplayMonth } from '../../../common/i18n/date-format.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { LeadEvent, OPEN_LEAD_STATES } from '../../../engines/state-machines/machines/lead.machine.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';
import { ActivityService } from '../../activities/application/activity.service.js';
import type { ActivityInput } from '../../activities/domain/activity.types.js';
import { PartyService } from '../../parties/application/party.service.js';
import { AttributionDisputeService } from '../../partners/application/attribution-dispute.service.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { LeadSourceKey } from '../domain/lead.constants.js';
import { AssignmentCloseReason, PartnerInboxView } from '../domain/lead-routing.constants.js';
import type { PartnerLeadPatchDto, PartnerReferralDto } from '../http/leads.dto.js';
import { LeadRepository, type PartnerAssignmentRow } from '../infrastructure/lead.repository.js';
import { type FollowUpRequest, LeadActivityService } from './lead-activity.service.js';
import { LeadCaptureService } from './lead-capture.service.js';
import { type ConversionReport, LeadConversionService } from './lead-conversion.service.js';
import { LeadRoutingService } from './lead-routing.service.js';
import { LeadSourceService } from './lead-source.service.js';
import { LeadTimeline } from './lead-timeline.service.js';
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
    private readonly leadActivities: LeadActivityService,
    private readonly capture: LeadCaptureService,
    private readonly sources: LeadSourceService,
    private readonly attributions: LeadAttributionService,
    private readonly routing: LeadRoutingService,
    private readonly conversions: LeadConversionService,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
    private readonly activityStore: ActivityService,
    private readonly disputes: AttributionDisputeService,
  ) {}

  async dashboard(actor: UserActor, ability: AppAbility) {
    const organizationId = this.organizationOf(actor);
    const assignments = accessibleBy(ability, AppAction.Read).ofType('LeadAssignment');
    const followUps = accessibleBy(ability, AppAction.Read).ofType('FollowUp');
    const now = new Date();
    const endOfToday = new Date(startOfDisplayDay(now).getTime() + DAY_MS);
    const offers = await this.leads.countAssignments({ AND: [assignments, { status: offered }] });
    const active = await this.leads.countAssignments({ AND: [assignments, { status: { in: [...WORKABLE] } }] });
    const firstContactDue = await this.leads.countAssignments({ AND: [assignments, { status: { in: [...WORKABLE] }, firstContactedAt: null }] });
    const dueToday = await this.activityStore.countFollowUps({ AND: [followUps, { status: FollowUpStatus.open, dueAt: { gte: now, lt: endOfToday } }] });
    const overdue = await this.activityStore.countFollowUps({ AND: [followUps, { status: FollowUpStatus.open, dueAt: { lt: now } }] });
    const conversionsPending = await this.leads.countConversions({ organizationId, status: OfflineConversionStatus.reported });
    const wonThisMonth = await this.leads.countConversions({ organizationId, status: OfflineConversionStatus.verified, decidedAt: { gte: startOfDisplayMonth(now) } });
    const protectedReferrals = await this.attributions.countActive(organizationId, now);
    return { leads: { offered: offers, active, firstContactDue }, followUps: { dueToday, overdue }, conversions: { pending: conversionsPending, wonThisMonth }, referrals: { protected: protectedReferrals }, at: now.toISOString() };
  }

  @Transactional()
  async refer(input: PartnerReferralDto, actor: UserActor, locale: Locale) {
    const organizationId = this.organizationOf(actor);
    const { requestConsent, consent, ...lead } = input;
    const scoped = consent ? { ...consent, items: consent.items.map((item) => (item.purpose === ConsentPurposeKey.PartnerSharing ? { ...item, organizationIds: [organizationId] } : item)) } : undefined;
    const captured = await this.capture.capture(
      { ...lead, consent: scoped },
      { source: await this.sources.activeByKey(LeadSourceKey.PartnerReferral), consentChannel: ConsentChannel.partner_assisted, answerChannel: AnswerChannel.partner, capturedByUserId: actor.userId, locale },
    );
    const leadId = captured.lead.id;
    const partyId = captured.lead.party.id;
    const others = (await this.leads.listOpenForParty(partyId, OPEN_LEAD_STATES)).map((row) => row.id).filter((id) => id !== leadId);
    if ((await this.attributions.activeFor(others)).some((attribution) => attribution.organizationId !== organizationId)) throw new AppError(ErrorCode.LEAD_PROTECTED);
    const attribution = await this.attributions.create({ leadId, organizationId, kind: AttributionKind.referral, createdByUserId: actor.userId });
    const details = { leadId, organizationId, protectedUntil: attribution.protectedUntil.toISOString() };
    await this.timeline.record(leadId, LeadEventType.referred, { data: details });
    await this.changes.record({ action: AuditAction.LeadReferred, entityType: AuditEntity.Lead, entityId: leadId, event: EventName.LeadReferred, metadata: { ref: captured.lead.ref, ...details }, payload: details });

    const routed = await this.routing.route(leadId, { record: true });
    const offer = routed.referral ? routed.assignments[0] : undefined;
    if (offer) {
      const assignment = await this.leads.findLatestAssignment({ id: offer.id });
      if (assignment) {
        await this.assignments.accept(assignment, actor.membershipId);
        await this.leadService.act(leadId, { event: LeadEvent.Start });
      }
    } else if (requestConsent && captured.lead.consentStatus !== LeadConsentStatus.ok) {
      await this.leadService.requestConsent(leadId, undefined, actor.userId);
    }
    const summary = { id: leadId, ref: captured.lead.ref, status: offer ? LeadStatus.in_progress : captured.lead.status, consentStatus: captured.lead.consentStatus };
    return { lead: summary, attribution: { protectedUntil: attribution.protectedUntil.toISOString() }, assigned: Boolean(offer), consentRequested: !offer && requestConsent && captured.lead.consentStatus !== LeadConsentStatus.ok };
  }

  async claimAttribution(actor: UserActor, input: { mobile: string; countryCode?: string; note: string }) {
    const organizationId = this.organizationOf(actor);
    const open = await this.leads.findOpenForParties(await this.parties.personPartyIdsByMobile(input.mobile, input.countryCode), OPEN_LEAD_STATES);
    const [held] = (await this.attributions.activeFor(open.map((lead) => lead.id))).filter((attribution) => attribution.organizationId !== organizationId);
    if (!held) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'mobile', code: 'not_protected', message: 'no other firm protects this borrower; refer them instead' }] });
    const dispute = await this.disputes.raise({ attribution: held, claimantOrganizationId: organizationId, source: DisputeSource.partner_claim, note: input.note, raisedByUserId: actor.userId });
    return dispute ? { id: dispute.id, status: dispute.status, createdAt: dispute.createdAt.toISOString() } : null;
  }

  async referrals(actor: UserActor, query: PageQuery) {
    const page = await this.attributions.listForOrganization(this.organizationOf(actor), query);
    const summaries = new Map((await this.leads.findSummaries(page.rows.map((row) => row.leadId))).map((lead) => [lead.id, lead]));
    return toPage(page.rows, page.limit, (row) => {
      const lead = summaries.get(row.leadId);
      return { id: row.id, protectedUntil: row.protectedUntil.toISOString(), createdAt: row.createdAt.toISOString(), lead: lead ? { id: lead.id, ref: lead.ref, status: lead.status, consentStatus: lead.consentStatus, name: lead.party.displayName } : null };
    });
  }

  @Transactional()
  async update(leadId: string, patch: PartnerLeadPatchDto, expectedVersion: number | undefined, ability: AppAbility) {
    await this.workable(leadId, ability, 'edit');
    await this.leadService.update(leadId, patch, expectedVersion);
    return this.detail(leadId, ability);
  }

  @Transactional()
  async reportConversion(leadId: string, input: ConversionReport, actor: UserActor, ability: AppAbility) {
    await this.leads.lockLead(leadId);
    const assignment = await this.workable(leadId, ability, 'offline_conversion');
    return this.conversions.report(assignment, input, actor.userId);
  }

  async conversionSource(leadId: string, ability: AppAbility) {
    const assignment = await this.workable(leadId, ability, 'convert');
    await this.assertShareable(assignment);
    const { lead } = assignment;
    return { leadId: lead.id, partyId: lead.partyId, segmentKey: lead.segmentKey, subSegmentKey: lead.subSegmentKey, categoryKey: lead.categoryKey, businessName: lead.businessParty?.displayName ?? null };
  }

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

  async activities(leadId: string, ability: AppAbility, query: PageQuery) {
    await this.current(leadId, ability, AppAction.Read);
    return this.leadActivities.list(leadId, accessibleBy(ability, AppAction.Read).ofType('Activity'), query);
  }

  @Transactional()
  async logActivity(leadId: string, input: ActivityInput, actor: UserActor, ability: AppAbility) {
    const assignment = await this.workable(leadId, ability, 'log_activity');
    return this.leadActivities.record(leadId, input, { userId: actor.userId, membershipId: actor.membershipId, organizationId: assignment.organizationId }, assignment);
  }

  @Transactional()
  async createFollowUp(leadId: string, request: FollowUpRequest, actor: UserActor, ability: AppAbility) {
    const assignment = await this.workable(leadId, ability, 'follow_up');
    if (request.assigneeMembershipId && !ability.can(AppAction.Assign, 'LeadAssignment')) throw new AppError(ErrorCode.FORBIDDEN);
    return this.leadActivities.createFollowUp(leadId, request, { userId: actor.userId, membershipId: actor.membershipId, organizationId: assignment.organizationId });
  }

  private async view(assignment: PartnerAssignmentRow, ability: AppAbility) {
    const contacts = await this.parties.listContacts(assignment.lead.partyId, false);
    const conversions = await this.conversions.forAssignment(assignment.id);
    return { ...toPartnerLeadView(assignment, contacts), conversions, availableActions: this.actionsFor(assignment, ability) };
  }

  private organizationOf(actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    return actor.organizationId;
  }

  private actionsFor(assignment: PartnerAssignmentRow, ability: AppAbility): string[] {
    if (assignment.status === offered) return ['accept', 'decline'];
    if (!WORKABLE.includes(assignment.status)) return [];
    const actions = ['reveal_contact', 'log_activity', 'follow_up', 'edit', 'offline_conversion', 'return', 'lost'];
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
