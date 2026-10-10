export const ACCOUNT_CONSENT_CONTEXT = 'communications';

export const CONSENT_LINK_TOKEN_PARAM = 'token';

export const CONSENT_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export const ConsentPurpose = { LenderSharing: 'lender_sharing', PartnerSharing: 'partner_sharing' } as const;
