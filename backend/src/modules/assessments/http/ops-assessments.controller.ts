import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { AnalysisService } from '../application/analysis.service.js';
import { type RecomputeDto, recomputeSchema } from './assessments.dto.js';

@Controller('ops/assessments')
@StaffOnly()
export class OpsAssessmentsController {
  constructor(private readonly analyses: AnalysisService) {}

  @Post(':id/recompute')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'))
  recompute(@ValidParam('id', uuidSchema) id: string, @ValidBody(recomputeSchema) body: RecomputeDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.analyses.recompute(id, body.mode, actor.userId, ability, locale);
  }
}
