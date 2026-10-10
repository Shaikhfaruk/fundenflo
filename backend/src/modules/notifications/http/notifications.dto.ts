import { z } from 'zod';

import { SUPPORTED_LOCALES } from '../../../common/i18n/locale.js';
import { EDITABLE_TEMPLATE_CHANNELS, NotificationTemplateKey, PROVIDER_TEMPLATE_ID_MAX_LENGTH, TEMPLATE_BODY_MAX_LENGTH, TEMPLATE_SUBJECT_MAX_LENGTH } from '../domain/notification.constants.js';

const templateKey = z.enum(Object.values(NotificationTemplateKey));

const channel = z.enum(EDITABLE_TEMPLATE_CHANNELS);

const locale = z.enum(SUPPORTED_LOCALES);

const subject = z.string().trim().min(1).max(TEMPLATE_SUBJECT_MAX_LENGTH).nullable();

const body = z.string().trim().min(1).max(TEMPLATE_BODY_MAX_LENGTH);

const providerTemplateId = z.string().trim().min(1).max(PROVIDER_TEMPLATE_ID_MAX_LENGTH).nullable();

export const listTemplatesSchema = z.object({ key: templateKey.optional(), channel: channel.optional(), locale: locale.optional(), active: z.enum(['true', 'false']).transform((value) => value === 'true').optional() });
export type ListTemplatesDto = z.output<typeof listTemplatesSchema>;

export const createTemplateSchema = z.object({ key: templateKey, channel, locale, subject: subject.default(null), body, providerTemplateId: providerTemplateId.default(null) }).strict();
export type CreateTemplateDto = z.output<typeof createTemplateSchema>;

export const updateTemplateSchema = z
  .object({ subject: subject.optional(), body: body.optional(), providerTemplateId: providerTemplateId.optional(), active: z.boolean().optional() })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'change at least one field' });
export type UpdateTemplateDto = z.output<typeof updateTemplateSchema>;

export const preferencesSchema = z.object({ sms: z.boolean(), email: z.boolean(), push: z.boolean() }).strict();
export type PreferencesDto = z.output<typeof preferencesSchema>;
