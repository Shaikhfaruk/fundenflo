import { EventName } from '../../common/events/event-names.js';
import { QueueName } from './queue-names.js';

export const EVENT_ROUTES: Partial<Record<EventName, QueueName[]>> = {
  [EventName.MembershipChanged]: [QueueName.AuthSessionRevocations],
  [EventName.UserStatusChanged]: [QueueName.AuthSessionRevocations],
};
