import { Injectable } from '@nestjs/common';

import { ActivityEntityType, AssignmentStatus, NotificationChannel, Role } from '../../../common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { formatDisplayDateTime } from '../../../common/i18n/date-format.js';
import { resolveLocale } from '../../../common/i18n/locale.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { UserNotifier } from '../../auth/application/user-notifier.service.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';

type AssignmentPayload = { assignmentId?: string; leadId?: string; entityId?: string; entityType?: string; assigneeUserId?: string; dueAt?: string; followUpId?: string };

const { sms, email, push } = NotificationChannel;

const display = (value: Date | string | null | undefined, locale: string | null) => (value ? formatDisplayDateTime(new Date(value), locale) : '');

@Injectable()
export class LeadNotificationService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly memberships: MembershipService,
    private readonly catalog: CatalogQueryService,
    private readonly notifier: UserNotifier,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<number> {
    const payload = (event.payload ?? {}) as AssignmentPayload;
    if (event.name === EventName.FollowUpDue) return this.followUpDue(payload);
    const assignment = payload.assignmentId ? await this.leads.findAssignment(payload.assignmentId) : null;
    if (!assignment) return 0;
    const lead = await this.leads.findDetail(assignment.leadId);
    if (!lead) return 0;
    const base = async (locale: string | null) => ({
      ref: lead.ref,
      city: lead.city?.name ?? lead.locationText ?? '',
      category: lead.categoryKey ? await this.catalog.categoryLabel(lead.categoryKey, resolveLocale(locale ?? undefined)) : 'loan',
      respondBy: display(assignment.respondBy, locale),
      firstContactBy: display(assignment.firstContactBy, locale),
      firm: assignment.organization.name,
    });
    const params = await this.paramsByLocale(base);
    const owners = () => this.memberships.activeUserIds(assignment.organizationId, [Role.partner_owner]);
    const assignee = async () => {
      const userId = assignment.assigneeMembershipId ? await this.memberships.activeUserIdOf(assignment.assigneeMembershipId) : null;
      return userId ? [userId] : owners();
    };
    switch (event.name) {
      case EventName.AssignmentOffered:
        return this.notifier.notify(await owners(), NotificationTemplateKey.LeadOffered, params, [push, sms, email]);
      case EventName.AssignmentOfferExpiring:
        return assignment.status === AssignmentStatus.offered ? this.notifier.notify(await owners(), NotificationTemplateKey.LeadOfferExpiring, params, [push, sms]) : 0;
      case EventName.AssignmentReassigned:
        return this.notifier.notify(await assignee(), NotificationTemplateKey.LeadHandedOver, params, [push, sms, email]);
      case EventName.LeadSlaWarned:
        return assignment.firstContactedAt ? 0 : this.notifier.notify(await assignee(), NotificationTemplateKey.LeadFirstContactDue, params, [push, sms]);
      case EventName.LeadSlaBreached:
        return this.notifier.notify(await this.memberships.activeStaffUserIds([Role.ops_lead]), NotificationTemplateKey.LeadFirstContactMissed, params, [email]);
      default:
        return 0;
    }
  }

  private async followUpDue(payload: AssignmentPayload) {
    if (payload.entityType !== ActivityEntityType.lead || !payload.entityId || !payload.assigneeUserId) return 0;
    const [lead] = await this.leads.findSummaries([payload.entityId]);
    if (!lead) return 0;
    return this.notifier.notify([payload.assigneeUserId], NotificationTemplateKey.FollowUpDue, (locale) => ({ ref: lead.ref, dueAt: display(payload.dueAt, locale) }), [push, sms]);
  }

  private async paramsByLocale(build: (locale: string | null) => Promise<Record<string, string>>) {
    const cache = new Map<string, Record<string, string>>();
    const en = await build('en');
    const hi = await build('hi');
    cache.set('en', en);
    cache.set('hi', hi);
    return (locale: string | null) => cache.get(resolveLocale(locale ?? undefined)) ?? en;
  }
}
