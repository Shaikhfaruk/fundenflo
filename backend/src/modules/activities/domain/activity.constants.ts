import { ActivityType } from '../../../common/enums/db.enums.js';

export const CONTACT_ACTIVITY_TYPES: readonly ActivityType[] = [ActivityType.call, ActivityType.meeting, ActivityType.whatsapp, ActivityType.email, ActivityType.sms];

export const ACTIVITY_BODY_MAX_LENGTH = 2_000;

export const ACTIVITY_MAX_DURATION_SECONDS = 8 * 3600;

export const ACTIVITY_BACKDATE_MAX_DAYS = 30;

export const ACTIVITY_CLOCK_SKEW_MS = 5 * 60_000;

export const FOLLOW_UP_MAX_DAYS_AHEAD = 180;

export const FOLLOW_UP_DUE_SLA_KIND = 'follow_up.due';

export const FOLLOW_UP_SLA_ENTITY = 'follow_up';

export const FOLLOW_UP_REMINDER_MINUTES = 30;
