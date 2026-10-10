import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { AnalysisService } from '../application/analysis.service.js';
import { type RequestAnalysisDto, requestAnalysisSchema } from './assessments.dto.js';

@Controller('applications')
@AllowContexts(SessionContext.borrower, SessionContext.partner)
export class ApplicationAssessmentsController {
  constructor(private readonly analyses: AnalysisService) {}

  @Post(':id/analyses')
  @HttpCode(HttpStatus.ACCEPTED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'))
  request(@ValidParam('id', uuidSchema) id: string, @ValidBody(requestAnalysisSchema) body: RequestAnalysisDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.analyses.request(id, body, actor.userId, ability, locale);
  }

  @Get(':id/assessment')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'))
  assessment(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.analyses.assessment(id, ability, locale);
  }
}
