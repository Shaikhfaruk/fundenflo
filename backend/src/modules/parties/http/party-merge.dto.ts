import { z } from 'zod';

import { MatchReviewStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { MatchReviewDecision } from '../domain/party.constants.js';

const reason = z.string().trim().min(5).max(1_000);

export const matchReviewListSchema = pageQuerySchema.extend({ status: z.enum(Object.values(MatchReviewStatus)).default(MatchReviewStatus.open) });
export type MatchReviewListDto = z.output<typeof matchReviewListSchema>;

export const resolveMatchReviewSchema = z
  .object({ decision: z.enum(Object.values(MatchReviewDecision)), survivorPartyId: z.uuid().optional(), mergedPartyId: z.uuid().optional(), note: reason })
  .strict()
  .refine((value) => value.decision !== MatchReviewDecision.Merge || (value.survivorPartyId && value.mergedPartyId), { path: ['survivorPartyId'], message: 'a merge needs survivorPartyId and mergedPartyId' });
export type ResolveMatchReviewDto = z.output<typeof resolveMatchReviewSchema>;

export const mergePartiesSchema = z.object({ survivorPartyId: z.uuid(), mergedPartyId: z.uuid(), reason }).strict();
export type MergePartiesDto = z.output<typeof mergePartiesSchema>;

export const mergeListSchema = pageQuerySchema.extend({ partyId: z.uuid().optional() });
export type MergeListDto = z.output<typeof mergeListSchema>;

export const revertMergeSchema = z.object({ reason }).strict();
export type RevertMergeDto = z.output<typeof revertMergeSchema>;
