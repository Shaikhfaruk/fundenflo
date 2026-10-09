import { z } from 'zod';

import { type LocalisedText, localisedLongTextSchema, localisedTextSchema } from '../../../common/i18n/locale.js';
import { MAX_CONSENT_ITEMS, PURPOSE_KEY_PATTERN } from './consent.constants.js';

export const consentTemplateContentSchema = z
  .object({
    policyUrl: z.url({ protocol: /^https$/ }).optional(),
    items: z
      .array(
        z
          .object({
            purpose: z.string().regex(PURPOSE_KEY_PATTERN),
            required: z.boolean().default(false),
            title: localisedTextSchema,
            summary: localisedTextSchema.optional(),
            details: localisedLongTextSchema,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_CONSENT_ITEMS),
  })
  .strict();

export type ConsentTemplateContent = z.output<typeof consentTemplateContentSchema>;

export type CompiledConsentItem = {
  purpose: string;
  required: boolean;
  title: LocalisedText;
  summary: LocalisedText | null;
  details: LocalisedText;
  textHash: string;
};

export type CompiledConsentTemplate = { policyUrl: string | null; items: CompiledConsentItem[] };
