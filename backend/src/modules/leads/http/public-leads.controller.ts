import { Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { AnswerChannel, ConsentChannel } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import type { AuthenticatedApiClient } from '../../access/application/api-client.service.js';
import { ApiScope } from '../../access/domain/access.constants.js';
import { ApiKeyAuth, CurrentApiClient } from '../../access/http/api-key.guard.js';
import { LeadCaptureService } from '../application/lead-capture.service.js';
import { LeadSourceService } from '../application/lead-source.service.js';
import { type PublicLeadDto, publicLeadSchema } from './leads.dto.js';

@Controller('public/leads')
export class PublicLeadsController {
  constructor(
    private readonly capture: LeadCaptureService,
    private readonly sources: LeadSourceService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiKeyAuth(ApiScope.LeadsCreate)
  async create(@ValidBody(publicLeadSchema) body: PublicLeadDto, @CurrentApiClient() client: AuthenticatedApiClient, @RequestLocale() locale: Locale, @Res({ passthrough: true }) response: Response) {
    if (!client.leadSourceId) throw new AppError(ErrorCode.FORBIDDEN, { details: { reason: 'this API key is not linked to a lead source' } });
    const result = await this.capture.capture(body, {
      source: await this.sources.activeById(client.leadSourceId),
      consentChannel: ConsentChannel.web_form,
      answerChannel: AnswerChannel.lead_source,
      apiClientId: client.actor.apiClientId,
      locale,
    });
    if (result.replayed) response.status(HttpStatus.OK);
    return { id: result.lead.id, ref: result.lead.ref, status: result.lead.status, replayed: result.replayed };
  }
}
