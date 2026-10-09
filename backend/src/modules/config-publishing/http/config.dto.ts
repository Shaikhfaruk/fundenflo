import { z } from 'zod';

import { CatalogStatus, ChangeRequestStatus, ConfigResource } from '../../../common/enums/db.enums.js';
import { localisedTextSchema } from '../../../common/i18n/locale.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { CONFIG_KEY_MAX_LENGTH, CONFIG_KEY_PATTERN } from '../domain/config.constants.js';

const noteSchema = z.string().trim().min(3).max(1_000);

export const versionNumberSchema = z.coerce.number().int().min(1);

export const configDocumentListSchema = pageQuerySchema.extend({ status: z.enum(Object.values(CatalogStatus)).optional() });
export type ConfigDocumentListQuery = z.output<typeof configDocumentListSchema>;

export const createConfigDocumentSchema = z
  .object({
    key: z.string().trim().max(CONFIG_KEY_MAX_LENGTH).regex(CONFIG_KEY_PATTERN, 'use lowercase words separated by dots, such as pre_check.msme'),
    name: localisedTextSchema,
    description: localisedTextSchema.optional(),
    content: z.unknown(),
    notes: noteSchema.optional(),
  })
  .strict();
export type CreateConfigDocumentDto = z.output<typeof createConfigDocumentSchema>;

export const updateConfigDocumentSchema = z
  .object({
    name: localisedTextSchema.optional(),
    description: localisedTextSchema.nullable().optional(),
    status: z.enum(Object.values(CatalogStatus)).optional(),
  })
  .strict();
export type UpdateConfigDocumentDto = z.output<typeof updateConfigDocumentSchema>;

export const createConfigVersionSchema = z
  .object({ fromNumber: versionNumberSchema.optional(), content: z.unknown().optional(), notes: noteSchema.optional() })
  .strict()
  .refine((body) => body.fromNumber === undefined || body.content === undefined, { message: 'send either fromNumber or content, not both', path: ['fromNumber'] });
export type CreateConfigVersionDto = z.output<typeof createConfigVersionSchema>;

export const updateConfigDraftSchema = z
  .object({ content: z.unknown().optional(), notes: noteSchema.nullable().optional() })
  .strict()
  .refine((body) => body.content !== undefined || body.notes !== undefined, { message: 'send content or notes', path: ['content'] });
export type UpdateConfigDraftDto = z.output<typeof updateConfigDraftSchema>;

export const submitConfigVersionSchema = z.object({ reason: noteSchema }).strict();
export type SubmitConfigVersionDto = z.output<typeof submitConfigVersionSchema>;

export const publishConfigVersionSchema = z.object({ effectiveFrom: z.coerce.date().optional() }).strict();
export type PublishConfigVersionDto = z.output<typeof publishConfigVersionSchema>;

export const retireConfigVersionSchema = z.object({ reason: noteSchema }).strict();
export type RetireConfigVersionDto = z.output<typeof retireConfigVersionSchema>;

export const changeRequestListSchema = pageQuerySchema.extend({
  status: z.enum(Object.values(ChangeRequestStatus)).optional(),
  resource: z.enum(Object.values(ConfigResource)).optional(),
});
export type ChangeRequestListQuery = z.output<typeof changeRequestListSchema>;

export const approveChangeRequestSchema = z.object({ note: noteSchema.optional() }).strict();
export type ApproveChangeRequestDto = z.output<typeof approveChangeRequestSchema>;

export const rejectChangeRequestSchema = z.object({ note: noteSchema }).strict();
export type RejectChangeRequestDto = z.output<typeof rejectChangeRequestSchema>;
