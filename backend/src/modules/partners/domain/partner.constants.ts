import { OrganizationStatus, Role } from '../../../common/enums/db.enums.js';

export const PARTNER_OWNER_ROLE = Role.partner_owner;

export const PARTNER_MEMBER_ROLE = Role.partner_agent;

export const FIRM_NAME_MAX_LENGTH = 120;

export const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,30}$/;

export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}$/;

export const WORKING_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MAX_SERVICE_AREAS = 500;

export const MAX_LANGUAGES = 12;

export const MAX_OPEN_LEADS_LIMIT = 10_000;

export const PARTNER_DECISION_NOTE_MAX_LENGTH = 1_000;

export const OPEN_REGISTRATION_STATUSES: OrganizationStatus[] = [OrganizationStatus.pending, OrganizationStatus.active, OrganizationStatus.suspended];

export const ServiceAreaType = {
  State: 'state',
  City: 'city',
  Pincode: 'pincode',
} as const;

export type ServiceAreaType = (typeof ServiceAreaType)[keyof typeof ServiceAreaType];

export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const REFERRAL_CODE_LENGTH = 8;

export const REFERRAL_CODE_ATTEMPTS = 5;

export const ATTRIBUTION_NOTE_MAX_LENGTH = 1_000;

export const AttributionEndReason = {
  Void: 'void',
} as const;

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GSTIN_PAN_SLICE = [2, 12] as const;

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;

export const BANK_ACCOUNT_VISIBLE_DIGITS = 4;

export const PARTNER_KYC_SOURCE = 'partner_kyc';

export const DECLARED_SOURCE = 'declared';
