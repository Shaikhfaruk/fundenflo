import { ConsentChannel } from '../../../common/enums/db.enums.js';

export const ConsentPurposeKey = {
  Contact: 'contact',
  PartnerSharing: 'partner_sharing',
  AiDocuments: 'ai_documents',
  CreditBureau: 'credit_bureau',
  LenderSharing: 'lender_sharing',
  Whatsapp: 'whatsapp',
  Marketing: 'marketing',
} as const;

export type ConsentPurposeKey = (typeof ConsentPurposeKey)[keyof typeof ConsentPurposeKey];

export const PURPOSE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export const MAX_CONSENT_ITEMS = 20;

export const MAX_SCOPE_ORGANIZATIONS = 50;

export const CONSENT_EVIDENCE_MAX_LENGTH = 1_000;

export const CONSENT_PURPOSE_CACHE_TAG = 'consent-purposes';

export const CONSENT_CACHE_TTL_SECONDS = 300;

export const CONSENT_VALIDITY_MAX_DAYS = 3_650;

export const TEMPLATE_REQUIRED_CHANNELS: ReadonlySet<ConsentChannel> = new Set([
  ConsentChannel.app,
  ConsentChannel.web_form,
  ConsentChannel.partner_assisted,
  ConsentChannel.sms_link,
  ConsentChannel.whatsapp_link,
]);

export const CONSENT_REQUEST_TTL_DAYS = 7;

export const CONSENT_REQUEST_TOKEN_BYTES = 32;

export const CONSENT_LINK_TOKEN_PARAM = 'token';

export const CONSENT_LINK_RATE_LIMIT = { name: 'consent-link', limit: 30, windowSeconds: 3600 } as const;
