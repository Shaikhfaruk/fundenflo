import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AnyContext, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { DataRequestService } from '../application/data-request.service.js';
import { type DataRequestDto, dataRequestSchema } from './privacy.dto.js';

@Controller('me/data-requests')
@AnyContext()
export class MeDataRequestsController {
  constructor(private readonly requests: DataRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@ValidBody(dataRequestSchema) body: DataRequestDto, @CurrentActor() actor: UserActor) {
    return this.requests.create(actor, body);
  }

  @Get()
  list(@CurrentActor() actor: UserActor) {
    return this.requests.mine(actor);
  }

  @Get(':id/export-url')
  exportUrl(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor) {
    return this.requests.exportUrl(actor, id);
  }
}
