import { z } from 'zod';

import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { DOCUMENT_KEY_PATTERN, DOCUMENT_PASSWORD_MAX_LENGTH } from './document.constants.js';

export const uploadFieldsSchema = z
  .strictObject({
    documentType: z.string().regex(DOCUMENT_KEY_PATTERN),
    applicationId: uuidSchema.optional(),
    borrowerProfileId: uuidSchema.optional(),
    lenderId: uuidSchema.optional(),
    submissionId: uuidSchema.optional(),
    password: z.string().min(1).max(DOCUMENT_PASSWORD_MAX_LENGTH).optional(),
  })
  .refine((fields) => [fields.applicationId, fields.borrowerProfileId, fields.lenderId, fields.submissionId].filter((value) => value !== undefined).length === 1, { path: ['applicationId'], message: 'give exactly one of applicationId, borrowerProfileId, lenderId or submissionId' });

export type UploadFields = z.output<typeof uploadFieldsSchema>;
