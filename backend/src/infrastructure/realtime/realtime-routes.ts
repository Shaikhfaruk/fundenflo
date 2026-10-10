import { EventName } from '../../common/events/event-names.js';
import { RealtimeEvent, RealtimeRoom } from './realtime.constants.js';

export type RealtimeEmit = { kind: 'emit'; rooms: string[]; event: RealtimeEvent; data: Record<string, unknown> };

export type RealtimeDisconnect = { kind: 'disconnect'; rooms: string[] };

export type RealtimeTarget = RealtimeEmit | RealtimeDisconnect;

type Payload = Record<string, unknown>;

const text = (payload: Payload, key: string): string | null => (typeof payload[key] === 'string' ? payload[key] : null);

const rooms = (...values: Array<string | null>) => [...new Set(values.filter((value): value is string => value !== null))];

const assignment = (payload: Payload): RealtimeTarget[] => {
  const organizationId = text(payload, 'organizationId');
  const membershipId = text(payload, 'assigneeMembershipId');
  return [
    {
      kind: 'emit',
      rooms: rooms(RealtimeRoom.staff, organizationId && RealtimeRoom.organization(organizationId), membershipId && RealtimeRoom.membership(membershipId)),
      event: RealtimeEvent.AssignmentChanged,
      data: { assignmentId: text(payload, 'assignmentId') ?? text(payload, 'entityId'), leadId: text(payload, 'leadId'), status: text(payload, 'to') ?? text(payload, 'status') },
    },
  ];
};

const lead = (payload: Payload): RealtimeTarget[] => [{ kind: 'emit', rooms: [RealtimeRoom.staff], event: RealtimeEvent.LeadChanged, data: { leadId: text(payload, 'leadId') ?? text(payload, 'entityId') } }];

const sla = (state: 'warned' | 'breached') => (payload: Payload): RealtimeTarget[] => {
  const organizationId = text(payload, 'organizationId');
  const membershipId = text(payload, 'assigneeMembershipId');
  return [
    {
      kind: 'emit',
      rooms: rooms(RealtimeRoom.staff, organizationId && RealtimeRoom.organization(organizationId), membershipId && RealtimeRoom.membership(membershipId)),
      event: RealtimeEvent.LeadSla,
      data: { assignmentId: text(payload, 'assignmentId'), leadId: text(payload, 'leadId'), kind: text(payload, 'kind'), state },
    },
  ];
};

const conversion = (payload: Payload): RealtimeTarget[] => {
  const organizationId = text(payload, 'organizationId');
  return [{ kind: 'emit', rooms: rooms(RealtimeRoom.staff, organizationId && RealtimeRoom.organization(organizationId)), event: RealtimeEvent.ConversionChanged, data: { conversionId: text(payload, 'conversionId'), leadId: text(payload, 'leadId'), status: text(payload, 'status') } }];
};

const document = (payload: Payload): RealtimeTarget[] => {
  const userId = text(payload, 'uploadedByUserId');
  const organizationId = text(payload, 'partnerOrganizationId');
  const targets = rooms(userId && RealtimeRoom.user(userId), organizationId && RealtimeRoom.organization(organizationId));
  return targets.length > 0 ? [{ kind: 'emit', rooms: targets, event: RealtimeEvent.DocumentChanged, data: { documentId: text(payload, 'documentId'), applicationId: text(payload, 'applicationId'), status: text(payload, 'status') } }] : [];
};

const ROUTES: Partial<Record<EventName, (payload: Payload) => RealtimeTarget[]>> = {
  [EventName.LeadCaptured]: lead,
  [EventName.LeadUpdated]: lead,
  [EventName.LeadStatusChanged]: lead,
  [EventName.LeadMerged]: lead,
  [EventName.AssignmentOffered]: assignment,
  [EventName.AssignmentAccepted]: assignment,
  [EventName.AssignmentDeclined]: assignment,
  [EventName.AssignmentExpired]: assignment,
  [EventName.AssignmentRevoked]: assignment,
  [EventName.AssignmentReturned]: assignment,
  [EventName.AssignmentCompleted]: assignment,
  [EventName.AssignmentReassigned]: assignment,
  [EventName.LeadSlaWarned]: sla('warned'),
  [EventName.LeadSlaBreached]: sla('breached'),
  [EventName.OfflineConversionReported]: conversion,
  [EventName.OfflineConversionVerified]: conversion,
  [EventName.OfflineConversionRejected]: conversion,
  [EventName.FollowUpDue]: (payload) => {
    const userId = text(payload, 'assigneeUserId');
    return userId ? [{ kind: 'emit', rooms: [RealtimeRoom.user(userId)], event: RealtimeEvent.FollowUpDue, data: { followUpId: text(payload, 'followUpId'), entityType: text(payload, 'entityType'), entityId: text(payload, 'entityId') } }] : [];
  },
  [EventName.ImportValidated]: (payload) => [{ kind: 'emit', rooms: [RealtimeRoom.staff], event: RealtimeEvent.ImportChanged, data: { importId: text(payload, 'entityId') } }],
  [EventName.ImportCommitted]: (payload) => [{ kind: 'emit', rooms: [RealtimeRoom.staff], event: RealtimeEvent.ImportChanged, data: { importId: text(payload, 'entityId') } }],
  [EventName.ImportUndone]: (payload) => [{ kind: 'emit', rooms: [RealtimeRoom.staff], event: RealtimeEvent.ImportChanged, data: { importId: text(payload, 'entityId') } }],
  [EventName.AnalysisCompleted]: (payload) => {
    const userId = text(payload, 'requestedByUserId');
    return userId ? [{ kind: 'emit', rooms: [RealtimeRoom.user(userId)], event: RealtimeEvent.AnalysisChanged, data: { analysisId: text(payload, 'analysisId'), applicationId: text(payload, 'applicationId'), status: text(payload, 'status') } }] : [];
  },
  [EventName.DocumentScanned]: document,
  [EventName.DocumentRejected]: document,
  [EventName.DocumentDeleted]: document,
  [EventName.MembershipChanged]: (payload) => {
    const membershipId = text(payload, 'membershipId');
    return membershipId && payload.status !== undefined && payload.status !== 'active' ? [{ kind: 'disconnect', rooms: [RealtimeRoom.membership(membershipId)] }] : [];
  },
  [EventName.UserStatusChanged]: (payload) => {
    const userId = text(payload, 'userId');
    return userId && payload.status !== 'active' ? [{ kind: 'disconnect', rooms: [RealtimeRoom.user(userId)] }] : [];
  },
};

export const REALTIME_EVENTS = Object.keys(ROUTES) as EventName[];

export function realtimeTargets(name: string, payload: Payload | null | undefined): RealtimeTarget[] {
  const route = ROUTES[name as EventName];
  return route ? route(payload ?? {}) : [];
}
