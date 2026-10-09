import type { ActivityEntityType, ActivityOutcome, ActivityType, FollowUpStatus } from '../../../common/enums/db.enums.js';

export type ActivityEntity = { type: ActivityEntityType; id: string };

export type ActivityActor = { userId: string; membershipId: string | null; organizationId: string | null };

export type ActivityInput = {
  type: ActivityType;
  outcome?: ActivityOutcome;
  body?: string;
  contactId?: string;
  durationSeconds?: number;
  occurredAt?: Date;
};

export type FollowUpInput = {
  dueAt: Date;
  note: string;
  assigneeUserId: string;
  assigneeMembershipId: string | null;
  organizationId: string | null;
};

export type FollowUpPatch = {
  status?: typeof FollowUpStatus.done | typeof FollowUpStatus.cancelled;
  dueAt?: Date;
  outcomeNote?: string;
};
