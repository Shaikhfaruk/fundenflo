import { describe, expect, it } from 'vitest';

import { RealtimeEvent, SyncType } from '@/lib/constants/realtime.constants';
import { keysForEvent, keysForSyncType } from './realtime-routing';

describe('realtime routing', () => {
  it('refreshes the case a document or analysis event names', () => {
    expect(keysForEvent(RealtimeEvent.DocumentChanged, { applicationId: 'a1' })).toEqual([['applications', 'detail', 'a1'], ['applications']]);
    expect(keysForEvent(RealtimeEvent.AnalysisChanged)).toEqual([['applications']]);
  });

  it('refreshes lead lists and the partner dashboard for lead events', () => {
    expect(keysForEvent(RealtimeEvent.AssignmentChanged)).toEqual([['ops-leads'], ['partner', 'dashboard']]);
    expect(keysForEvent(RealtimeEvent.SubmissionChanged, { applicationId: 'a2' })[0]).toEqual(['lender']);
    expect(keysForEvent('unknown.event')).toEqual([]);
  });

  it('maps sync change types to the same caches', () => {
    expect(keysForSyncType(SyncType.Lead)).toEqual([['ops-leads'], ['partner', 'dashboard']]);
    expect(keysForSyncType(SyncType.FollowUp)).toEqual([['partner', 'dashboard']]);
    expect(keysForSyncType('payout')).toEqual([]);
  });
});
