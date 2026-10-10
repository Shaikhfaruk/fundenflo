import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { RateLimitByIp } from '../../../infrastructure/rate-limit/rate-limit.guard.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { DocumentService } from '../application/document.service.js';
import { DOCUMENT_UPLOAD_FIELD, DOCUMENT_UPLOAD_IP_RATE_LIMIT } from '../domain/document.constants.js';
import type { StagedUpload } from '../infrastructure/document-upload.engine.js';
import { type ListDocumentsDto, listDocumentsSchema } from './documents.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Document'));

@Controller('documents')
@AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.staff)
export class DocumentsController {
  constructor(private readonly documents: DocumentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.lender, SessionContext.staff)
  @RateLimitByIp(DOCUMENT_UPLOAD_IP_RATE_LIMIT)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Document'))
  @UseInterceptors(FileInterceptor(DOCUMENT_UPLOAD_FIELD))
  upload(@UploadedFile() file: StagedUpload | undefined, @Body() fields: unknown, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.documents.upload(file, fields, actor, ability);
  }

  @Get()
  @canRead
  list(@ValidQuery(listDocumentsSchema) query: ListDocumentsDto, @CurrentAbility() ability: AppAbility) {
    return this.documents.list(ability, query);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.documents.get(id, ability);
  }

  @Get(':id/download-url')
  @AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.lender, SessionContext.staff)
  @CheckPolicies((ability) => ability.can(AppAction.Download, 'Document'))
  downloadUrl(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.documents.downloadUrl(id, ability);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowContexts(SessionContext.borrower, SessionContext.partner)
  @CheckPolicies((ability) => ability.can(AppAction.Delete, 'Document'))
  async remove(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    await this.documents.remove(id, actor, ability);
  }
}
