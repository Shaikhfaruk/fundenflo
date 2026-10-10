import type { QueryKey } from '@tanstack/react-query';

import { applicationKeys } from '@/lib/api/applications';
import { opsLeadKeys } from '@/lib/api/leads';
import { lenderKeys } from '@/lib/api/lender';
import { partnerKeys } from '@/lib/api/partners';
import { RealtimeEvent, SyncType } from '@/lib/constants/realtime.constants';

type EventData = { applicationId?: unknown };

const applicationScope = (data: EventData): QueryKey[] => (typeof data.applicationId === 'string' ? [applicationKeys.detail(data.applicationId), applicationKeys.all] : [applicationKeys.all]);

export function keysForEvent(event: string, data: EventData = {}): QueryKey[] {
  switch (event) {
    case RealtimeEvent.LeadChanged:
    case RealtimeEvent.AssignmentChanged:
    case RealtimeEvent.LeadSla:
    case RealtimeEvent.ConversionChanged:
      return [opsLeadKeys.all, partnerKeys.dashboard()];
    case RealtimeEvent.FollowUpDue:
      return [partnerKeys.dashboard()];
    case RealtimeEvent.DocumentChanged:
    case RealtimeEvent.AnalysisChanged:
      return applicationScope(data);
    case RealtimeEvent.SubmissionChanged:
      return [lenderKeys.all, ...applicationScope(data)];
    default:
      return [];
  }
}

export function keysForSyncType(type: string): QueryKey[] {
  if (type === SyncType.Lead || type === SyncType.Assignment) return [opsLeadKeys.all, partnerKeys.dashboard()];
  if (type === SyncType.FollowUp) return [partnerKeys.dashboard()];
  return [];
}
