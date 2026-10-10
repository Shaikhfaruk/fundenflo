import { EventName } from '../../common/events/event-names.js';
import { REALTIME_EVENTS } from '../realtime/realtime-routes.js';
import { QueueName } from './queue-names.js';

const ROUTES: Partial<Record<EventName, QueueName[]>> = {
  [EventName.MembershipChanged]: [QueueName.AuthSessionRevocations],
  [EventName.UserStatusChanged]: [QueueName.AuthSessionRevocations],
  [EventName.OrganizationStatusChanged]: [QueueName.AuthSessionRevocations],
  [EventName.ConsentGranted]: [QueueName.LeadsConsentSync, QueueName.ApplicationsRefresh, QueueName.DocumentsExtract],
  [EventName.ConsentWithdrawn]: [QueueName.LeadsConsentSync, QueueName.ApplicationsRefresh],
  [EventName.PartyMerged]: [QueueName.LeadsConsentSync],
  [EventName.PartyMergeReverted]: [QueueName.LeadsConsentSync],
  [EventName.UserSignedUp]: [QueueName.LeadsDropoff, QueueName.LeadsReferrals],
  [EventName.LeadCaptured]: [QueueName.LeadsRoute],
  [EventName.LeadStatusChanged]: [QueueName.LeadsRoute],
  [EventName.LeadUpdated]: [QueueName.LeadsRoute],
  [EventName.AssignmentDeclined]: [QueueName.LeadsRoute],
  [EventName.AssignmentExpired]: [QueueName.LeadsRoute],
  [EventName.AssignmentRevoked]: [QueueName.LeadsRoute],
  [EventName.AssignmentOffered]: [QueueName.LeadsNotify],
  [EventName.AssignmentOfferExpiring]: [QueueName.LeadsNotify],
  [EventName.AssignmentReassigned]: [QueueName.LeadsNotify],
  [EventName.LeadSlaWarned]: [QueueName.LeadsNotify],
  [EventName.LeadSlaBreached]: [QueueName.LeadsNotify],
  [EventName.FollowUpDue]: [QueueName.LeadsNotify],
  [EventName.DocumentUploaded]: [QueueName.DocumentsScan, QueueName.ApplicationsRefresh],
  [EventName.DocumentScanOverdue]: [QueueName.DocumentsScan],
  [EventName.DocumentRejected]: [QueueName.ApplicationsRefresh],
  [EventName.DocumentDeleted]: [QueueName.ApplicationsRefresh],
  [EventName.BorrowerProfileChanged]: [QueueName.ApplicationsRefresh, QueueName.RiskDetect],
  [EventName.AnalysisRequested]: [QueueName.AnalysisRun],
  [EventName.DocumentScanned]: [QueueName.DocumentsExtract, QueueName.SubmissionsSync, QueueName.RiskDetect],
  [EventName.ScoreComputed]: [QueueName.MatchingRun],
  [EventName.SubmissionApproved]: [QueueName.SubmissionsDeliver],
  [EventName.SubmissionStatusChanged]: [QueueName.SubmissionsNotify, QueueName.NotificationsSubscriptions],
  [EventName.SubmissionDisbursed]: [QueueName.NotificationsSubscriptions, QueueName.CommissionsAccrue],
  [EventName.PayoutPaid]: [QueueName.CommissionsNotify],
  [EventName.DataRequestReceived]: [QueueName.PrivacyRequests],
  [EventName.LeadReferred]: [QueueName.RiskDetect],
  [EventName.PartnerKycUpdated]: [QueueName.RiskDetect],
  [EventName.ConsistencySignalRaised]: [QueueName.RiskDetect],
  [EventName.DocumentRequested]: [QueueName.SubmissionsNotify],
  [EventName.AnalysisCompleted]: [QueueName.NotificationsSubscriptions],
  [EventName.ApplicationStatusChanged]: [QueueName.NotificationsSubscriptions, QueueName.SubmissionsSync],
};

export const EVENT_ROUTES: Partial<Record<EventName, QueueName[]>> = { ...ROUTES };

for (const name of REALTIME_EVENTS) EVENT_ROUTES[name] = [...(ROUTES[name] ?? []), QueueName.RealtimePublish];
