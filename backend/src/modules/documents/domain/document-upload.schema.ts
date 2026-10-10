import { z } from 'zod';

import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { DOCUMENT_KEY_PATTERN, DOCUMENT_PASSWORD_MAX_LENGTH } from './document.constants.js';

export const uploadFieldsSchema = z
  .strictObject({
    documentType: z.string().regex(DOCUMENT_KEY_PATTERN),
    applicationId: uuidSchema.optional(),
    borrowerProfileId: uuidSchema.optional(),
    password: z.string().min(1).max(DOCUMENT_PASSWORD_MAX_LENGTH).optional(),
  })
  .refine((fields) => (fields.applicationId === undefined) !== (fields.borrowerProfileId === undefined), { path: ['applicationId'], message: 'give either applicationId or borrowerProfileId' });

export type UploadFields = z.output<typeof uploadFieldsSchema>;
