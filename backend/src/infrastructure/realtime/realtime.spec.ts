import { describe, expect, it } from 'vitest';

import { EventName } from '../../common/events/event-names.js';
import { realtimeTargets } from './realtime-routes.js';

describe('realtime routes', () => {
  it('sends assignment changes to staff, the firm and the assignee, with ids only', () => {
    const [target] = realtimeTargets(EventName.AssignmentAccepted, { assignmentId: 'a1', leadId: 'l1', organizationId: 'o1', assigneeMembershipId: 'm1', to: 'accepted', reason: 'x' });
    expect(target).toEqual({ kind: 'emit', rooms: ['staff', 'org:o1', 'membership:m1'], event: 'lead.assignment.changed', data: { assignmentId: 'a1', leadId: 'l1', status: 'accepted' } });
  });

  it('keeps lead changes to staff and follow-ups to their assignee', () => {
    expect(realtimeTargets(EventName.LeadCaptured, { leadId: 'l1', ref: 'LD-26-1' })).toEqual([{ kind: 'emit', rooms: ['staff'], event: 'lead.changed', data: { leadId: 'l1' } }]);
    expect(realtimeTargets(EventName.FollowUpDue, { followUpId: 'f1', assigneeUserId: 'u1', entityType: 'lead', entityId: 'l1' })[0]).toMatchObject({ rooms: ['user:u1'] });
    expect(realtimeTargets(EventName.FollowUpDue, { followUpId: 'f1' })).toEqual([]);
  });

  it('disconnects sockets of suspended memberships and users and ignores unknown events', () => {
    expect(realtimeTargets(EventName.MembershipChanged, { membershipId: 'm1', status: 'suspended' })).toEqual([{ kind: 'disconnect', rooms: ['membership:m1'] }]);
    expect(realtimeTargets(EventName.MembershipChanged, { membershipId: 'm1', status: 'active' })).toEqual([]);
    expect(realtimeTargets(EventName.UserStatusChanged, { userId: 'u1', status: 'suspended' })).toEqual([{ kind: 'disconnect', rooms: ['user:u1'] }]);
    expect(realtimeTargets('consent.granted', { partyId: 'p1' })).toEqual([]);
  });
});
