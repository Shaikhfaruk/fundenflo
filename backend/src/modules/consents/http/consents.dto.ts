import { z } from 'zod';

import { CatalogStatus, ConsentBasis, ConsentChannel, ConsentScopeKind, OrganizationType } from '../../../common/enums/db.enums.js';
import { localisedTextSchema, SUPPORTED_LOCALES } from '../../../common/i18n/locale.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { CONFIG_KEY_PATTERN } from '../../config-publishing/domain/config.constants.js';
import { CONSENT_EVIDENCE_MAX_LENGTH, CONSENT_VALIDITY_MAX_DAYS, MAX_CONSENT_ITEMS, MAX_SCOPE_ORGANIZATIONS, PURPOSE_KEY_PATTERN } from '../domain/consent.constants.js';

export const purposeKeySchema = z.string().trim().regex(PURPOSE_KEY_PATTERN, 'use lowercase letters, digits and underscores');

const basesSchema = z.array(z.enum(Object.values(ConsentBasis))).min(1);

export const listPurposesSchema = z.object({ status: z.enum(Object.values(CatalogStatus)).optional() });
export type ListPurposesQuery = z.output<typeof listPurposesSchema>;

export const createPurposeSchema = z
  .object({
    key: purposeKeySchema,
    label: localisedTextSchema,
    description: localisedTextSchema.optional(),
    scopeKind: z.enum(Object.values(ConsentScopeKind)).default(ConsentScopeKind.none),
    scopeOrganizationType: z.enum([OrganizationType.partner, OrganizationType.lender]).optional(),
    allowedBases: basesSchema,
    validityDays: z.number().int().min(1).max(CONSENT_VALIDITY_MAX_DAYS).optional(),
  })
  .strict();
export type CreatePurposeDto = z.output<typeof createPurposeSchema>;

export const updatePurposeSchema = z
  .object({
    label: localisedTextSchema.optional(),
    description: localisedTextSchema.nullable().optional(),
    allowedBases: basesSchema.optional(),
    validityDays: z.number().int().min(1).max(CONSENT_VALIDITY_MAX_DAYS).nullable().optional(),
    status: z.enum(Object.values(CatalogStatus)).optional(),
  })
  .strict();
export type UpdatePurposeDto = z.output<typeof updatePurposeSchema>;

export const templateQuerySchema = z.object({ context: z.string().trim().regex(CONFIG_KEY_PATTERN) });
export type TemplateQuery = z.output<typeof templateQuerySchema>;

const itemSchema = z
  .object({
    purpose: purposeKeySchema,
    granted: z.boolean(),
    organizationIds: z.array(z.uuid()).min(1).max(MAX_SCOPE_ORGANIZATIONS).optional(),
  })
  .strict();

const itemsSchema = z.array(itemSchema).min(1).max(MAX_CONSENT_ITEMS);

export const myConsentsSchema = z
  .object({
    templateVersionId: z.uuid(),
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    clientRecordedAt: z.coerce.date().optional(),
    items: itemsSchema,
  })
  .strict();
export type MyConsentsDto = z.output<typeof myConsentsSchema>;

export const withdrawSchema = z.object({ organizationIds: z.array(z.uuid()).min(1).max(MAX_SCOPE_ORGANIZATIONS).optional() }).strict();
export type WithdrawDto = z.output<typeof withdrawSchema>;

export const opsConsentsSchema = z
  .object({
    channel: z.enum([ConsentChannel.ops_call, ConsentChannel.import, ConsentChannel.web_form, ConsentChannel.sms_link, ConsentChannel.whatsapp_link, ConsentChannel.partner_assisted]),
    basis: z.enum(Object.values(ConsentBasis)).default(ConsentBasis.consent),
    templateVersionId: z.uuid().optional(),
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    evidence: z.string().trim().min(5).max(CONSENT_EVIDENCE_MAX_LENGTH).optional(),
    clientRecordedAt: z.coerce.date().optional(),
    items: itemsSchema,
  })
  .strict();
export type OpsConsentsDto = z.output<typeof opsConsentsSchema>;

export const consentHistorySchema = pageQuerySchema.extend({ purpose: purposeKeySchema.optional() });
export type ConsentHistoryQuery = z.output<typeof consentHistorySchema>;

export const consentLinkSubmitSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    items: z.array(z.object({ purpose: purposeKeySchema, granted: z.boolean() }).strict()).min(1).max(MAX_CONSENT_ITEMS),
  })
  .strict();
export type ConsentLinkSubmitDto = z.output<typeof consentLinkSubmitSchema>;
