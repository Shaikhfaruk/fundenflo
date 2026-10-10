import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { MatchingService } from '../application/matching.service.js';

@Controller('applications')
@AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.staff)
export class ApplicationMatchesController {
  constructor(private readonly matching: MatchingService) {}

  @Post(':id/matches')
  @HttpCode(HttpStatus.CREATED)
  @AllowContexts(SessionContext.borrower, SessionContext.partner)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'))
  run(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.matching.request(id, actor.userId, ability, locale);
  }

  @Get(':id/matches/latest')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'))
  latest(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.matching.latest(id, ability, locale, actor.context === SessionContext.staff);
  }
}
