import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { SubscriptionService } from '../application/subscription.service.js';
import { SUBSCRIPTION_CHANNELS, SubscriptionEvent } from '../domain/subscription.constants.js';

const subscribeSchema = z.object({ event: z.enum(Object.values(SubscriptionEvent)), entityId: z.uuid(), channel: z.enum(SUBSCRIPTION_CHANNELS) }).strict();

type SubscribeDto = z.output<typeof subscribeSchema>;

@Controller('notifications/subscriptions')
@AllowContexts(SessionContext.borrower, SessionContext.partner)
export class NotificationSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'))
  subscribe(@ValidBody(subscribeSchema) body: SubscribeDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.subscriptions.subscribe(actor.userId, body, ability);
  }
}
