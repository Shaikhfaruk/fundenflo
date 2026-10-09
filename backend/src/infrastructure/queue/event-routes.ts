import { EventName } from '../../common/events/event-names.js';
import { QueueName } from './queue-names.js';

export const EVENT_ROUTES: Partial<Record<EventName, QueueName[]>> = {
  [EventName.MembershipChanged]: [QueueName.AuthSessionRevocations],
  [EventName.UserStatusChanged]: [QueueName.AuthSessionRevocations],
  [EventName.OrganizationStatusChanged]: [QueueName.AuthSessionRevocations],
  [EventName.ConsentGranted]: [QueueName.LeadsConsentSync],
  [EventName.ConsentWithdrawn]: [QueueName.LeadsConsentSync],
  [EventName.UserSignedUp]: [QueueName.LeadsDropoff],
  [EventName.LeadCaptured]: [QueueName.LeadsRoute],
  [EventName.LeadStatusChanged]: [QueueName.LeadsRoute],
  [EventName.LeadUpdated]: [QueueName.LeadsRoute],
};
