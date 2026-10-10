import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AllowContexts, CurrentActor, Public } from '../../../common/auth/auth.decorators.js';
import { COMPAT_PREFIX } from '../../../common/constants/http.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { DOCUMENT_UPLOAD_FIELD, DOCUMENT_UPLOAD_IP_RATE_LIMIT } from '../../documents/domain/document.constants.js';
import type { StagedUpload } from '../../documents/infrastructure/document-upload.engine.js';
import { CompatJourneyService } from '../application/compat-journey.service.js';
import {
  type CompatAnalysisDto,
  type CompatAnalysisRefDto,
  compatAnalysisRefSchema,
  compatAnalysisSchema,
  type CompatApplyDto,
  compatApplySchema,
  type CompatCategoriesDto,
  compatCategoriesSchema,
  type CompatConsentDto,
  compatConsentSchema,
  type CompatPreCheckDto,
  compatPreCheckSchema,
  type CompatRequirementDto,
  compatRequirementSchema,
  type CompatSubscriptionDto,
  compatSubscriptionSchema,
  submissionRefSchema,
} from './compat.dto.js';

const canUpdateApplication = CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'));

const canReadApplication = CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'));

@Controller(COMPAT_PREFIX)
@AllowContexts(SessionContext.borrower)
export class CompatJourneyController {
  constructor(
    private readonly journey: CompatJourneyService,
    private readonly documents: DocumentService,
  ) {}

  @Public()
  @Get('loan/categories')
  categories(@ValidQuery(compatCategoriesSchema) query: CompatCategoriesDto, @RequestLocale() locale: Locale) {
    return this.journey.categories(query.entityType, locale);
  }

  @Post('loan/requirement')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LoanApplication'))
  requirement(@ValidBody(compatRequirementSchema) body: CompatRequirementDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.journey.requirement(body, actor, ability);
  }

  @Post('loan/pre-check')
  @HttpCode(HttpStatus.OK)
  @canUpdateApplication
  preCheck(@ValidBody(compatPreCheckSchema) body: CompatPreCheckDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.journey.preCheck(body, actor, ability);
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @canUpdateApplication
  consent(@ValidBody(compatConsentSchema) body: CompatConsentDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.consent(body, actor, ability, locale);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @RateLimitByIp(DOCUMENT_UPLOAD_IP_RATE_LIMIT)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Document'))
  @UseInterceptors(FileInterceptor(DOCUMENT_UPLOAD_FIELD))
  upload(@UploadedFile() file: StagedUpload | undefined, @Body() fields: unknown, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.journey.upload(file, fields, actor, ability);
  }

  @Get('documents/:id')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Document'))
  documentStatus(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.journey.documentStatus(id, ability);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies((ability) => ability.can(AppAction.Delete, 'Document'))
  async removeDocument(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    await this.documents.remove(id, actor, ability);
  }

  @Post('analysis')
  @HttpCode(HttpStatus.ACCEPTED)
  @canUpdateApplication
  startAnalysis(@ValidBody(compatAnalysisSchema) body: CompatAnalysisDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.startAnalysis(body, actor, ability, locale);
  }

  @Get('analysis/:id')
  @canReadApplication
  analysis(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.analysis(id, ability, locale);
  }

  @Post('notifications/whatsapp')
  @HttpCode(HttpStatus.OK)
  @canReadApplication
  subscribe(@ValidBody(compatSubscriptionSchema) body: CompatSubscriptionDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.subscribe(body, actor, ability, locale);
  }

  @Post('score')
  @HttpCode(HttpStatus.OK)
  @canReadApplication
  score(@ValidBody(compatAnalysisRefSchema) body: CompatAnalysisRefDto, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.score(body.analysisId, ability, locale);
  }

  @Post('lenders')
  @HttpCode(HttpStatus.OK)
  @canUpdateApplication
  lenders(@ValidBody(compatAnalysisRefSchema) body: CompatAnalysisRefDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.lenders(body.analysisId, actor, ability, locale);
  }

  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LenderSubmission'))
  apply(@ValidBody(compatApplySchema) body: CompatApplyDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.apply(body.lenderId, actor, ability, locale);
  }

  @Get('applications/:ref')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LenderSubmission'))
  application(@ValidParam('ref', submissionRefSchema) ref: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.journey.application(ref, actor, ability, locale);
  }
}
