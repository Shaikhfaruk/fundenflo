import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { AnswerChannel } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { QuestionnaireService } from '../application/questionnaire.service.js';
import { type AnswerHistoryQuery, answerHistorySchema, type SubmitAnswersDto, submitAnswersSchema } from './questionnaires.dto.js';

@Controller('ops/parties/:partyId/answers')
@StaffOnly()
export class OpsAnswersController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'))
  list(@ValidParam('partyId', uuidSchema) partyId: string, @ValidQuery(answerHistorySchema) query: AnswerHistoryQuery) {
    return this.questionnaires.listAnswers(partyId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Party'))
  submit(@ValidParam('partyId', uuidSchema) partyId: string, @ValidBody(submitAnswersSchema) body: SubmitAnswersDto, @CurrentActor() actor: UserActor) {
    const { answers, ...context } = body;
    return this.questionnaires.submitAnswers(partyId, context, answers, { channel: AnswerChannel.ops, answeredByUserId: actor.userId });
  }
}
