import { Controller, Get, Put } from '@nestjs/common';

import { AnyContext, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { NotificationPreferenceService } from '../application/notification-preference.service.js';
import { type PreferencesDto, preferencesSchema } from './notifications.dto.js';

@Controller('me/notification-preferences')
@AnyContext()
export class MeNotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferenceService) {}

  @Get()
  get(@CurrentActor() actor: UserActor) {
    return this.preferences.get(actor.userId);
  }

  @Put()
  update(@ValidBody(preferencesSchema) body: PreferencesDto, @CurrentActor() actor: UserActor, @IfMatchVersion() version: number | undefined) {
    return this.preferences.update(actor.userId, body, version);
  }
}
