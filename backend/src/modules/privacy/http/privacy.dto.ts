import { z } from 'zod';

import { DataRequestKind, DataRequestStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { DATA_REQUEST_DETAILS_MAX_LENGTH } from '../domain/privacy.constants.js';

const text = z.string().trim().min(3).max(DATA_REQUEST_DETAILS_MAX_LENGTH);

export const dataRequestSchema = z.object({ kind: z.enum(Object.values(DataRequestKind)), details: text.optional() }).strict();
export type DataRequestDto = z.output<typeof dataRequestSchema>;

export const listDataRequestsSchema = pageQuerySchema.extend({ status: z.enum(Object.values(DataRequestStatus)).optional(), kind: z.enum(Object.values(DataRequestKind)).optional() });
export type ListDataRequestsDto = z.output<typeof listDataRequestsSchema>;

export const completeDataRequestSchema = z.object({ response: text }).strict();
export type CompleteDataRequestDto = z.output<typeof completeDataRequestSchema>;

export const rejectDataRequestSchema = z.object({ reason: text }).strict();
export type RejectDataRequestDto = z.output<typeof rejectDataRequestSchema>;
