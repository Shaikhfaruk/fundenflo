import { ConsentBasis, ConsentScopeKind, OrganizationType } from '../../common/enums/db.enums.js';
import type { ConsentTemplateContent } from '../../modules/consents/domain/consent-template.schema.js';
import { ConsentPurposeKey } from '../../modules/consents/domain/consent.constants.js';

export type ConsentPurposeSeed = {
  key: string;
  label: string;
  scopeKind: ConsentScopeKind;
  scopeOrganizationType: OrganizationType | null;
  allowedBases: ConsentBasis[];
};

const CONSENT_ONLY = [ConsentBasis.consent];

export const CONSENT_PURPOSE_SEEDS: ConsentPurposeSeed[] = [
  { key: ConsentPurposeKey.Contact, label: 'Contact Me About My Loan Enquiry', scopeKind: ConsentScopeKind.none, scopeOrganizationType: null, allowedBases: [ConsentBasis.consent, ConsentBasis.legitimate_use] },
  { key: ConsentPurposeKey.PartnerSharing, label: 'Share My Enquiry With A FundenFlo Partner', scopeKind: ConsentScopeKind.organizations, scopeOrganizationType: OrganizationType.partner, allowedBases: CONSENT_ONLY },
  { key: ConsentPurposeKey.AiDocuments, label: 'Read My Documents With AI', scopeKind: ConsentScopeKind.none, scopeOrganizationType: null, allowedBases: CONSENT_ONLY },
  { key: ConsentPurposeKey.CreditBureau, label: 'Fetch My Credit Bureau Report', scopeKind: ConsentScopeKind.none, scopeOrganizationType: null, allowedBases: CONSENT_ONLY },
  { key: ConsentPurposeKey.LenderSharing, label: 'Share My File With Lenders I Choose', scopeKind: ConsentScopeKind.organizations, scopeOrganizationType: OrganizationType.lender, allowedBases: CONSENT_ONLY },
  { key: ConsentPurposeKey.Whatsapp, label: 'Message Me On WhatsApp', scopeKind: ConsentScopeKind.none, scopeOrganizationType: null, allowedBases: CONSENT_ONLY },
  { key: ConsentPurposeKey.Marketing, label: 'Send Me Offers And Updates', scopeKind: ConsentScopeKind.none, scopeOrganizationType: null, allowedBases: CONSENT_ONLY },
];

export const JOURNEY_CONSENT_TEMPLATE: { key: string; name: string; notes: string; content: ConsentTemplateContent } = {
  key: 'journey',
  name: 'Borrower Journey Consent',
  notes: 'Seeded from the v0.1 app consent screen (CONSENT_VERSION 2026-10-v1)',
  content: {
    items: [
      {
        purpose: ConsentPurposeKey.AiDocuments,
        required: true,
        title: { en: 'Read My Documents With AI' },
        summary: { en: 'Required · To Calculate Your Financial Health Score' },
        details: {
          en: 'The Documents You Upload (Bank Statements, GST Returns, ITR) Are Read Automatically To Extract Income, Cash-Flow And Repayment Patterns. These Are Used Only To Calculate Your Financial Health Score And Improvement Plan.',
        },
      },
      {
        purpose: ConsentPurposeKey.CreditBureau,
        required: false,
        title: { en: 'Fetch My Credit Bureau Report' },
        summary: { en: 'Optional · Helps Match Lenders Accurately' },
        details: {
          en: 'With Your Permission We Request Your Credit Report From A Credit Bureau To Understand Your Existing Loans And Repayment History. If You Keep This Off, Matching Uses Only The Information You Provide.',
        },
      },
      {
        purpose: ConsentPurposeKey.LenderSharing,
        required: false,
        title: { en: 'Share My File With Lenders I Choose' },
        summary: { en: 'Optional · Nothing Is Sent Without Your Approval' },
        details: {
          en: 'Your Loan File Is Shared Only With The Specific Lenders You Select, And Only After You Confirm. If You Keep This Off You Still Get Your Score And Improvement Plan; You Can Turn It On Before Applying.',
        },
      },
    ],
  },
};

export const COMMUNICATIONS_CONSENT_TEMPLATE: { key: string; name: string; notes: string; content: ConsentTemplateContent } = {
  key: 'communications',
  name: 'Account Communication Choices',
  notes: 'Opt-ins shown under Account › Consents',
  content: {
    items: [
      {
        purpose: ConsentPurposeKey.Whatsapp,
        required: false,
        title: { en: 'Message Me On WhatsApp' },
        summary: { en: 'Optional · Status updates and reminders' },
        details: { en: 'We send loan status updates, document reminders and replies from your advisor on WhatsApp. You can turn this off any time.' },
      },
      {
        purpose: ConsentPurposeKey.Marketing,
        required: false,
        title: { en: 'Send Me Offers And Updates' },
        summary: { en: 'Optional · New products and tips' },
        details: { en: 'We tell you about new lender products and ways to improve your Financial Health Score. We never sell your details.' },
      },
    ],
  },
};

export const CONSENT_TEMPLATE_SEEDS = [JOURNEY_CONSENT_TEMPLATE, COMMUNICATIONS_CONSENT_TEMPLATE];
