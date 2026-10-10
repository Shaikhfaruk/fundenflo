import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DAY_MS, MINUTE_MS } from '../../../common/constants/time.constants.js';
import { ActivityType, FollowUpStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ACTIVITY_BACKDATE_MAX_DAYS, ACTIVITY_CLOCK_SKEW_MS, FOLLOW_UP_DUE_SLA_KIND, FOLLOW_UP_MAX_DAYS_AHEAD, FOLLOW_UP_REMINDER_MINUTES, FOLLOW_UP_SLA_ENTITY } from '../domain/activity.constants.js';
import type { ActivityActor, ActivityEntity, ActivityInput, FollowUpInput, FollowUpPatch } from '../domain/activity.types.js';
import { SlaService } from '../../sla/application/sla.service.js';
import { ActivityRepository } from '../infrastructure/activity.repository.js';
import { toActivityView, toFollowUpView } from './activity.views.js';

type Issue = { path: string; code: string; message: string };

const FOLLOW_UP_CANCEL_BATCH = 500;

@Injectable()
export class ActivityService {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly sla: SlaService,
  ) {}

  async log(entity: ActivityEntity, input: ActivityInput, actor: ActivityActor) {
    const now = Date.now();
    const occurredAt = input.occurredAt ?? new Date(now);
    const issues: Issue[] = [];
    if (occurredAt.getTime() > now + ACTIVITY_CLOCK_SKEW_MS) issues.push({ path: 'occurredAt', code: 'in_future', message: 'cannot be in the future' });
    if (occurredAt.getTime() < now - ACTIVITY_BACKDATE_MAX_DAYS * DAY_MS) issues.push({ path: 'occurredAt', code: 'too_old', message: `at most ${ACTIVITY_BACKDATE_MAX_DAYS} days ago` });
    if (input.outcome && input.type !== ActivityType.call) issues.push({ path: 'outcome', code: 'calls_only', message: 'an outcome is recorded for calls only' });
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    const activity = await this.activities.createActivity({
      entityType: entity.type,
      entityId: entity.id,
      organizationId: actor.organizationId,
      type: input.type,
      outcome: input.outcome ?? null,
      body: input.body ?? null,
      contactId: input.contactId ?? null,
      durationSeconds: input.durationSeconds ?? null,
      occurredAt,
      actorUserId: actor.userId,
      actorMembershipId: actor.membershipId,
    });
    return toActivityView(activity);
  }

  async list(entity: ActivityEntity, scope: Prisma.ActivityWhereInput, query: PageQuery) {
    const window = pageWindow(query);
    const rows = await this.activities.listActivities({ AND: [scope, { entityType: entity.type, entityId: entity.id, id: window.idFilter }] }, window.take);
    return toPage(rows, query.limit, toActivityView);
  }

  async createFollowUp(entity: ActivityEntity, input: FollowUpInput, createdByUserId: string) {
    this.assertDueAt(input.dueAt);
    const followUp = await this.activities.createFollowUp({ entityType: entity.type, entityId: entity.id, ...input, createdByUserId });
    await this.scheduleReminder(followUp.id, followUp.dueAt);
    return toFollowUpView(followUp);
  }

  async listFollowUps(scope: Prisma.FollowUpWhereInput, filters: { status?: FollowUpStatus; dueBefore?: Date; entityIds?: string[] }, limit: number) {
    const where: Prisma.FollowUpWhereInput = { AND: [scope, { status: filters.status, dueAt: filters.dueBefore ? { lt: filters.dueBefore } : undefined, entityId: filters.entityIds ? { in: filters.entityIds } : undefined }] };
    const now = new Date();
    return (await this.activities.listFollowUps(where, limit)).map((row) => toFollowUpView(row, now));
  }

  async cancelOpenFollowUps(entity: ActivityEntity, organizationId: string, outcomeNote: string) {
    const where = { entityType: entity.type, entityId: entity.id, organizationId, status: FollowUpStatus.open };
    const open = await this.activities.listFollowUps(where, FOLLOW_UP_CANCEL_BATCH);
    if (open.length === 0) return 0;
    await this.sla.cancel(open.map((followUp) => followUp.id), [FOLLOW_UP_DUE_SLA_KIND]);
    return (await this.activities.updateFollowUps({ ...where, id: { in: open.map((followUp) => followUp.id) } }, { status: FollowUpStatus.cancelled, doneAt: new Date(), outcomeNote })).count;
  }

  async findFollowUp(id: string, scope: Prisma.FollowUpWhereInput) {
    const followUp = await this.activities.findFollowUp({ AND: [scope, { id }] });
    if (!followUp) throw new AppError(ErrorCode.NOT_FOUND);
    return followUp;
  }

  @Transactional()
  async updateFollowUp(id: string, scope: Prisma.FollowUpWhereInput, patch: FollowUpPatch, expectedVersion: number | undefined, actorUserId: string) {
    const followUp = await this.findFollowUp(id, scope);
    assertVersion(expectedVersion, followUp.version);
    if (followUp.status !== FollowUpStatus.open) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: followUp.status, event: patch.status ?? 'reschedule', allowed: [] } });
    if (patch.dueAt) this.assertDueAt(patch.dueAt);
    const data: Prisma.FollowUpUncheckedUpdateManyInput = { dueAt: patch.dueAt, outcomeNote: patch.outcomeNote };
    if (patch.status) Object.assign(data, { status: patch.status, doneAt: new Date(), doneByUserId: actorUserId });
    const moved = await this.activities.updateFollowUpVersioned(id, followUp.version, data);
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    if (patch.status) await this.sla.cancel(id, [FOLLOW_UP_DUE_SLA_KIND]);
    else if (patch.dueAt) await this.scheduleReminder(id, patch.dueAt);
    return toFollowUpView(await this.findFollowUp(id, scope));
  }

  private async scheduleReminder(followUpId: string, dueAt: Date) {
    await this.sla.start(FOLLOW_UP_DUE_SLA_KIND, { type: FOLLOW_UP_SLA_ENTITY, id: followUpId }, dueAt, new Date(dueAt.getTime() - FOLLOW_UP_REMINDER_MINUTES * MINUTE_MS));
  }

  private assertDueAt(dueAt: Date) {
    const now = Date.now();
    if (dueAt.getTime() <= now) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'dueAt', code: 'in_past', message: 'must be in the future' }] });
    if (dueAt.getTime() > now + FOLLOW_UP_MAX_DAYS_AHEAD * DAY_MS) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'dueAt', code: 'too_far', message: `at most ${FOLLOW_UP_MAX_DAYS_AHEAD} days ahead` }] });
  }
}
