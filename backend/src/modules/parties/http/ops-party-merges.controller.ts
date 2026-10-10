import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { PartyMergeService } from '../application/party-merge.service.js';
import {
  type MatchReviewListDto,
  matchReviewListSchema,
  type MergeListDto,
  mergeListSchema,
  type MergePartiesDto,
  mergePartiesSchema,
  type ResolveMatchReviewDto,
  resolveMatchReviewSchema,
  type RevertMergeDto,
  revertMergeSchema,
} from './party-merge.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'Party'));

@Controller('ops')
@StaffOnly()
export class OpsPartyMergesController {
  constructor(private readonly merges: PartyMergeService) {}

  @Get('party-match-reviews')
  @canRead
  reviews(@ValidQuery(matchReviewListSchema) query: MatchReviewListDto) {
    return this.merges.listReviews(query.status, query);
  }

  @Get('party-match-reviews/:id')
  @canRead
  review(@ValidParam('id', uuidSchema) id: string) {
    return this.merges.getReview(id);
  }

  @Post('party-match-reviews/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  resolve(@ValidParam('id', uuidSchema) id: string, @ValidBody(resolveMatchReviewSchema) body: ResolveMatchReviewDto, @CurrentActor() actor: UserActor) {
    return this.merges.resolveReview(id, body.decision, body, actor.userId);
  }

  @Post('parties/merge')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  merge(@ValidBody(mergePartiesSchema) body: MergePartiesDto, @CurrentActor() actor: UserActor) {
    return this.merges.merge({ sourcePartyId: body.mergedPartyId, targetPartyId: body.survivorPartyId, reason: body.reason }, actor.userId);
  }

  @Get('party-merges')
  @canRead
  list(@ValidQuery(mergeListSchema) query: MergeListDto) {
    return this.merges.listMerges(query.partyId, query);
  }

  @Post('party-merges/:id/revert')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  revert(@ValidParam('id', uuidSchema) id: string, @ValidBody(revertMergeSchema) body: RevertMergeDto, @CurrentActor() actor: UserActor) {
    return this.merges.revert(id, body.reason, actor.userId);
  }
}
