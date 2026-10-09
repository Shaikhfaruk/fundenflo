import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { ConsentPurposeService } from '../application/consent-purpose.service.js';
import { type CreatePurposeDto, createPurposeSchema, type ListPurposesQuery, listPurposesSchema, type UpdatePurposeDto, updatePurposeSchema } from './consents.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'ConsentPurpose'));

@Controller('admin/consent-purposes')
@StaffOnly()
export class AdminConsentPurposesController {
  constructor(private readonly purposes: ConsentPurposeService) {}

  @Get()
  @canRead
  async list(@ValidQuery(listPurposesSchema) query: ListPurposesQuery) {
    return { items: await this.purposes.list(query.status) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'ConsentPurpose'))
  create(@ValidBody(createPurposeSchema) body: CreatePurposeDto) {
    return this.purposes.create(body);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.purposes.get(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'ConsentPurpose'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updatePurposeSchema) body: UpdatePurposeDto, @IfMatchVersion() version: number | undefined) {
    return this.purposes.update(id, body, version);
  }
}
