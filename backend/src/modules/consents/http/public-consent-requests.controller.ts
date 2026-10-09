import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';

import { Public } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { ConsentRequestService } from '../application/consent-request.service.js';
import { CONSENT_LINK_RATE_LIMIT } from '../domain/consent.constants.js';
import { type ConsentLinkSubmitDto, consentLinkSubmitSchema } from './consents.dto.js';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

@Controller('public/consent-requests/:token')
@Public()
export class PublicConsentRequestsController {
  constructor(private readonly requests: ConsentRequestService) {}

  @Get()
  @RateLimitByIp(CONSENT_LINK_RATE_LIMIT)
  view(@ValidParam('token', tokenSchema) token: string, @RequestLocale() locale: Locale) {
    return this.requests.view(token, locale);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RateLimitByIp(CONSENT_LINK_RATE_LIMIT)
  submit(@ValidParam('token', tokenSchema) token: string, @ValidBody(consentLinkSubmitSchema) body: ConsentLinkSubmitDto, @RequestLocale() requestLocale: Locale) {
    return this.requests.submit(token, body.items, body.locale ?? requestLocale);
  }
}
