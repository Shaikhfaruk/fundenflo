import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { LeadSourceService } from '../application/lead-source.service.js';
import { type LeadSourceDto, type LeadSourceListQuery, leadSourceListSchema, type LeadSourcePatchDto, leadSourcePatchSchema, leadSourceSchema } from './leads.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LeadSource'));

@Controller('admin/lead-sources')
@StaffOnly()
export class AdminLeadSourcesController {
  constructor(private readonly sources: LeadSourceService) {}

  @Get()
  @canRead
  async list(@ValidQuery(leadSourceListSchema) query: LeadSourceListQuery) {
    return { items: await this.sources.list(query.status) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LeadSource'))
  create(@ValidBody(leadSourceSchema) body: LeadSourceDto) {
    return this.sources.create(body);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.sources.get(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'LeadSource'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadSourcePatchSchema) body: LeadSourcePatchDto, @IfMatchVersion() version: number | undefined) {
    return this.sources.update(id, body, version);
  }
}
