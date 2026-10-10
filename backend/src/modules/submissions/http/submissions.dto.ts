import { z } from 'zod';

import { SubmissionStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { DOCUMENT_KEY_PATTERN } from '../../documents/domain/document.constants.js';
import { DOCUMENT_REQUEST_DUE_DAYS_MAX, DOCUMENT_REQUEST_TYPES_MAX, LENDER_REFERENCE_MAX_LENGTH, RejectionReason, SUBMISSION_NOTE_MAX_LENGTH, SubmissionAction } from '../domain/submission.constants.js';

const note = z.string().trim().min(3).max(SUBMISSION_NOTE_MAX_LENGTH);

const amountPaise = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const lenderReference = z.string().trim().min(1).max(LENDER_REFERENCE_MAX_LENGTH);

const expectedVersion = z.number().int().positive().optional();

export const requestSubmissionSchema = z.object({ matchResultId: uuidSchema, shareWithLender: z.literal(true).optional() }).strict();
export type RequestSubmissionDto = z.output<typeof requestSubmissionSchema>;

export const withdrawSubmissionSchema = z.object({ reason: note }).strict();
export type WithdrawSubmissionDto = z.output<typeof withdrawSubmissionSchema>;

export const approveSubmissionSchema = z.object({ note: note.optional(), expectedVersion }).strict();
export type ApproveSubmissionDto = z.output<typeof approveSubmissionSchema>;

const acknowledge = z.object({ action: z.literal(SubmissionAction.Acknowledge), lenderReference: lenderReference.optional(), note: note.optional(), expectedVersion }).strict();
const raiseQuery = z.object({ action: z.literal(SubmissionAction.RaiseQuery), note, expectedVersion }).strict();
const answerQuery = z.object({ action: z.literal(SubmissionAction.AnswerQuery), note: note.optional(), expectedVersion }).strict();
const sanction = z.object({ action: z.literal(SubmissionAction.Sanction), amountPaise, lenderReference: lenderReference.optional(), evidenceDocumentId: uuidSchema.optional(), note: note.optional(), expectedVersion }).strict();
const disburse = z.object({ action: z.literal(SubmissionAction.Disburse), amountPaise, evidenceDocumentId: uuidSchema.optional(), note: note.optional(), expectedVersion }).strict();
const reject = z.object({ action: z.literal(SubmissionAction.Reject), reason: z.enum(Object.values(RejectionReason)), note: note.optional(), expectedVersion }).strict();
const withdraw = z.object({ action: z.literal(SubmissionAction.Withdraw), note, expectedVersion }).strict();
const remark = z.object({ action: z.literal(SubmissionAction.Note), note, expectedVersion }).strict();

export const lenderSubmissionActionSchema = z.discriminatedUnion('action', [acknowledge, raiseQuery, sanction, disburse, reject, remark]);
export type LenderSubmissionActionDto = z.output<typeof lenderSubmissionActionSchema>;

export const opsSubmissionActionSchema = z.discriminatedUnion('action', [acknowledge, raiseQuery, answerQuery, sanction, disburse, reject, withdraw, remark]);
export type OpsSubmissionActionDto = z.output<typeof opsSubmissionActionSchema>;

export const documentRequestSchema = z
  .object({
    documentTypes: z.array(z.string().regex(DOCUMENT_KEY_PATTERN)).min(1).max(DOCUMENT_REQUEST_TYPES_MAX),
    note: note.optional(),
    dueInDays: z.number().int().min(1).max(DOCUMENT_REQUEST_DUE_DAYS_MAX).optional(),
  })
  .strict();
export type DocumentRequestDto = z.output<typeof documentRequestSchema>;

export const listSubmissionsSchema = pageQuerySchema.extend({ status: z.enum(Object.values(SubmissionStatus)).optional(), lenderId: uuidSchema.optional(), applicationId: uuidSchema.optional() });
export type ListSubmissionsDto = z.output<typeof listSubmissionsSchema>;
