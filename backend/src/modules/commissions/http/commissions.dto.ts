import { z } from 'zod';

import { PayoutStatus, ReceivableStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { FINANCE_NOTE_MAX_LENGTH, RECONCILIATION_LINES_MAX, ReceivableAction, ReconciliationSource } from '../domain/commission.constants.js';

const amountPaise = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const day = z.iso.date();

const utr = z.string().trim().regex(/^[A-Za-z0-9]{6,30}$/, 'use the 6-30 character bank reference');

const note = z.string().trim().min(3).max(FINANCE_NOTE_MAX_LENGTH);

const expectedVersion = z.number().int().positive().optional();

export const listReceivablesSchema = pageQuerySchema.extend({ status: z.enum(Object.values(ReceivableStatus)).optional(), lenderId: uuidSchema.optional(), submissionId: uuidSchema.optional() });
export type ListReceivablesDto = z.output<typeof listReceivablesSchema>;

export const receivableActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal(ReceivableAction.Invoice), invoiceNumber: z.string().trim().min(1).max(40), on: day.optional(), expectedVersion }).strict(),
  z.object({ action: z.literal(ReceivableAction.Receive), amountPaise, utr: utr.optional(), on: day.optional(), expectedVersion }).strict(),
  z.object({ action: z.literal(ReceivableAction.Reconcile), expectedVersion }).strict(),
  z.object({ action: z.literal(ReceivableAction.WriteOff), reason: note, expectedVersion }).strict(),
]);
export type ReceivableActionDto = z.output<typeof receivableActionSchema>;

export const listPayoutsSchema = pageQuerySchema.extend({ status: z.enum(Object.values(PayoutStatus)).optional(), partnerOrganizationId: uuidSchema.optional() });
export type ListPayoutsDto = z.output<typeof listPayoutsSchema>;

export const approvePayoutSchema = z.object({ expectedVersion }).strict();
export type ApprovePayoutDto = z.output<typeof approvePayoutSchema>;

export const markPaidSchema = z.object({ utr, paidOn: day.optional(), expectedVersion }).strict();
export type MarkPaidDto = z.output<typeof markPaidSchema>;

export const reversePayoutSchema = z.object({ reason: note, expectedVersion }).strict();
export type ReversePayoutDto = z.output<typeof reversePayoutSchema>;

export const reconciliationSchema = z
  .object({
    lenderId: uuidSchema.optional(),
    source: z.enum(Object.values(ReconciliationSource)),
    lines: z.array(z.object({ reference: z.string().trim().min(1).max(60), amountPaise, utr: utr.optional(), paidOn: day.optional() }).strict()).min(1).max(RECONCILIATION_LINES_MAX),
  })
  .strict();
export type ReconciliationDto = z.output<typeof reconciliationSchema>;

export const statementSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use YYYY-MM') }).strict();
export type StatementDto = z.output<typeof statementSchema>;
