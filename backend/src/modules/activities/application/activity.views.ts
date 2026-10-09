import { FollowUpStatus } from '../../../common/enums/db.enums.js';
import type { Activity, FollowUp } from '../../../generated/prisma/client.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toActivityView = (activity: Activity) => ({
  id: activity.id,
  entityType: activity.entityType,
  entityId: activity.entityId,
  organizationId: activity.organizationId,
  type: activity.type,
  outcome: activity.outcome,
  body: activity.body,
  contactId: activity.contactId,
  durationSeconds: activity.durationSeconds,
  occurredAt: activity.occurredAt.toISOString(),
  actorUserId: activity.actorUserId,
  actorMembershipId: activity.actorMembershipId,
  createdAt: activity.createdAt.toISOString(),
});

export const toFollowUpView = (followUp: FollowUp, now = new Date()) => ({
  id: followUp.id,
  entityType: followUp.entityType,
  entityId: followUp.entityId,
  organizationId: followUp.organizationId,
  assigneeUserId: followUp.assigneeUserId,
  assigneeMembershipId: followUp.assigneeMembershipId,
  dueAt: followUp.dueAt.toISOString(),
  overdue: followUp.status === FollowUpStatus.open && followUp.dueAt < now,
  note: followUp.note,
  status: followUp.status,
  doneAt: iso(followUp.doneAt),
  outcomeNote: followUp.outcomeNote,
  createdByUserId: followUp.createdByUserId,
  version: followUp.version,
  createdAt: followUp.createdAt.toISOString(),
  updatedAt: followUp.updatedAt.toISOString(),
});
