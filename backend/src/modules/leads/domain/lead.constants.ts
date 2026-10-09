import { LeadSourceKind } from '../../../common/enums/db.enums.js';

export const LEAD_QUALITY_WEIGHTS = {
  mobile: 25,
  email: 5,
  name: 10,
  segment: 10,
  category: 15,
  amount: 10,
  location: 15,
  consent: 10,
} as const;

export const LeadSourceKey = {
  Manual: 'manual',
  Import: 'import',
  AppDropoff: 'app_dropoff',
} as const;

export type LeadSourceKey = (typeof LeadSourceKey)[keyof typeof LeadSourceKey];

export const SYSTEM_LEAD_SOURCES: Array<{ key: LeadSourceKey; name: string; kind: LeadSourceKind }> = [
  { key: LeadSourceKey.Manual, name: 'Ops manual entry', kind: LeadSourceKind.manual },
  { key: LeadSourceKey.Import, name: 'Backlog and file imports', kind: LeadSourceKind.import },
  { key: LeadSourceKey.AppDropoff, name: 'App users who stopped mid-journey', kind: LeadSourceKind.app_dropoff },
];

export const LEAD_SOURCE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export const LEAD_DUPLICATE_WINDOW_DAYS = 30;

export const LEAD_REF_PREFIX = 'LD';

export const LEAD_TEXT_MAX_LENGTH = 200;

export const LEAD_NOTE_MAX_LENGTH = 1_000;

export const LEAD_MERGE_MAX = 20;

export const LEAD_EVENTS_IN_DETAIL = 50;

export const LEAD_RAW_PAYLOAD_MAX_BYTES = 32_000;

export const DEFAULT_LEAD_CONSENT_CONTEXT = 'lead_capture';

export const DROPOFF_CHECK_JOB = 'check';
