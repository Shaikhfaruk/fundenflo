import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { NotificationTemplateService } from '../application/notification-template.service.js';
import { type CreateTemplateDto, createTemplateSchema, type ListTemplatesDto, listTemplatesSchema, type UpdateTemplateDto, updateTemplateSchema } from './notifications.dto.js';

@Controller('admin/notification-templates')
@StaffOnly()
export class AdminNotificationTemplatesController {
  constructor(private readonly templates: NotificationTemplateService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'NotificationTemplate'))
  async list(@ValidQuery(listTemplatesSchema) query: ListTemplatesDto) {
    return { items: await this.templates.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'NotificationTemplate'))
  create(@ValidBody(createTemplateSchema) body: CreateTemplateDto) {
    return this.templates.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'NotificationTemplate'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateTemplateSchema) body: UpdateTemplateDto, @IfMatchVersion() version: number | undefined) {
    return this.templates.update(id, body, version);
  }
}
