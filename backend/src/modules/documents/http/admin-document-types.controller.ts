import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { DocumentTypeService } from '../application/document-type.service.js';
import { type CreateDocumentTypeDto, createDocumentTypeSchema, type ListDocumentTypesDto, listDocumentTypesSchema, type UpdateDocumentTypeDto, updateDocumentTypeSchema } from './documents.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'DocumentType'));

@Controller('admin/document-types')
@StaffOnly()
export class AdminDocumentTypesController {
  constructor(private readonly types: DocumentTypeService) {}

  @Get()
  @canRead
  async list(@ValidQuery(listDocumentTypesSchema) query: ListDocumentTypesDto) {
    return { items: await this.types.list(query.status) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'DocumentType'))
  create(@ValidBody(createDocumentTypeSchema) body: CreateDocumentTypeDto) {
    return this.types.create(body);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.types.get(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'DocumentType'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateDocumentTypeSchema) body: UpdateDocumentTypeDto, @IfMatchVersion() version: number | undefined) {
    return this.types.update(id, body, version);
  }
}
