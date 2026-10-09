import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { ApiClientService } from '../application/api-client.service.js';
import { AppAction } from '../domain/ability.types.js';
import { type CreateApiClientDto, createApiClientSchema } from './access.dto.js';
import { CheckPolicies } from './policies.guard.js';

@Controller('admin/api-clients')
@StaffOnly()
export class AdminApiClientsController {
  constructor(private readonly clients: ApiClientService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'ApiClient'))
  async list() {
    return { items: await this.clients.list() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'ApiClient'))
  create(@ValidBody(createApiClientSchema) body: CreateApiClientDto, @CurrentActor() actor: UserActor) {
    return this.clients.create(body, actor);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Delete, 'ApiClient'))
  revoke(@ValidParam('id', uuidSchema) id: string) {
    return this.clients.revoke(id);
  }
}
