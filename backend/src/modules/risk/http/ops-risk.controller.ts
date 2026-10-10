import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { FraudDecision, FraudReviewStatus, RiskSeverity, RiskSignalKind, RiskSignalStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { RiskService } from '../application/risk.service.js';
import { RISK_DECISION_NOTE_MAX_LENGTH } from '../domain/risk.constants.js';

const signalsSchema = pageQuerySchema.extend({
  kind: z.enum(Object.values(RiskSignalKind)).optional(),
  severity: z.enum(Object.values(RiskSeverity)).optional(),
  status: z.enum(Object.values(RiskSignalStatus)).optional(),
  applicationId: uuidSchema.optional(),
  partyId: uuidSchema.optional(),
});
type SignalsDto = z.output<typeof signalsSchema>;

const reviewsSchema = pageQuerySchema.extend({ status: z.enum(Object.values(FraudReviewStatus)).optional() });
type ReviewsDto = z.output<typeof reviewsSchema>;

const decisionSchema = z.object({ decision: z.enum(Object.values(FraudDecision)), note: z.string().trim().min(10).max(RISK_DECISION_NOTE_MAX_LENGTH), expectedVersion: z.number().int().positive().optional() }).strict();
type DecisionDto = z.output<typeof decisionSchema>;

const canReadReviews = CheckPolicies((ability) => ability.can(AppAction.Read, 'FraudReview'));

@Controller('ops')
@StaffOnly()
export class OpsRiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('risk-signals')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'RiskSignal'))
  signals(@ValidQuery(signalsSchema) query: SignalsDto, @CurrentAbility() ability: AppAbility) {
    return this.risk.signals(ability, query);
  }

  @Get('fraud-reviews')
  @canReadReviews
  reviews(@ValidQuery(reviewsSchema) query: ReviewsDto, @CurrentAbility() ability: AppAbility) {
    return this.risk.reviews(ability, query);
  }

  @Get('fraud-reviews/:id')
  @canReadReviews
  review(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.risk.review(id, ability);
  }

  @Post('fraud-reviews/:id/decision')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'FraudReview'))
  decide(@ValidParam('id', uuidSchema) id: string, @ValidBody(decisionSchema) body: DecisionDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.risk.decide(id, body, actor, ability);
  }
}
