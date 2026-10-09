import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { ConsentService } from '../application/consent.service.js';
import { type ConsentHistoryQuery, consentHistorySchema, type OpsConsentsDto, opsConsentsSchema } from './consents.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'));

@Controller('ops/parties/:partyId/consents')
@StaffOnly()
export class OpsConsentsController {
  constructor(private readonly consents: ConsentService) {}

  @Get()
  @canRead
  async current(@ValidParam('partyId', uuidSchema) partyId: string, @RequestLocale() locale: Locale) {
    return { items: await this.consents.current(partyId, locale) };
  }

  @Get('history')
  @canRead
  history(@ValidParam('partyId', uuidSchema) partyId: string, @ValidQuery(consentHistorySchema) query: ConsentHistoryQuery) {
    return this.consents.history(partyId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Party'))
  record(@ValidParam('partyId', uuidSchema) partyId: string, @ValidBody(opsConsentsSchema) body: OpsConsentsDto, @CurrentActor() actor: UserActor, @RequestLocale() requestLocale: Locale) {
    const { items, locale, ...capture } = body;
    return this.consents.record(partyId, items, { ...capture, locale: locale ?? requestLocale, capturedByUserId: actor.userId }, locale ?? requestLocale);
  }
}
