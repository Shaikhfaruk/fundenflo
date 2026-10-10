import { Controller, Get } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { PartnerLeadService } from '../application/partner-lead.service.js';

@Controller('partner/dashboard')
@AllowContexts(SessionContext.partner)
export class PartnerDashboardController {
  constructor(private readonly leads: PartnerLeadService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LeadAssignment'))
  dashboard(@CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.leads.dashboard(actor, ability);
  }
}
