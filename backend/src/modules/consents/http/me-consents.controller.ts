import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AnyContext, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { ConsentChannel } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { MeService } from '../../auth/application/me.service.js';
import { ConsentService } from '../application/consent.service.js';
import { type MyConsentsDto, myConsentsSchema, purposeKeySchema, type WithdrawDto, withdrawSchema } from './consents.dto.js';

@Controller('me/consents')
@AnyContext()
export class MeConsentsController {
  constructor(
    private readonly consents: ConsentService,
    private readonly me: MeService,
  ) {}

  @Get()
  async list(@CurrentActor() actor: UserActor, @RequestLocale() locale: Locale) {
    return { items: await this.consents.current(await this.me.partyIdOf(actor.userId), locale) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async give(@ValidBody(myConsentsSchema) body: MyConsentsDto, @CurrentActor() actor: UserActor, @RequestLocale() requestLocale: Locale) {
    const partyId = await this.me.partyIdOf(actor.userId);
    const locale = body.locale ?? requestLocale;
    return this.consents.record(partyId, body.items, { channel: ConsentChannel.app, templateVersionId: body.templateVersionId, locale, capturedByUserId: actor.userId, clientRecordedAt: body.clientRecordedAt }, locale);
  }

  @Post(':purpose/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(@ValidParam('purpose', purposeKeySchema) purpose: string, @ValidBody(withdrawSchema) body: WithdrawDto, @CurrentActor() actor: UserActor, @RequestLocale() locale: Locale) {
    const partyId = await this.me.partyIdOf(actor.userId);
    return this.consents.record(partyId, [{ purpose, granted: false, organizationIds: body.organizationIds }], { channel: ConsentChannel.app, capturedByUserId: actor.userId }, locale);
  }
}
