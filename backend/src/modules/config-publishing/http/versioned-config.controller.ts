import { Controller, Get, HttpCode, HttpStatus, Inject, Patch, Post, type Type } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import type { ConfigResource } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { ConfigPublishingService } from '../application/config-publishing.service.js';
import { configSubject } from '../application/config-subject.js';
import {
  type ConfigDocumentListQuery,
  configDocumentListSchema,
  type CreateConfigDocumentDto,
  createConfigDocumentSchema,
  type CreateConfigVersionDto,
  createConfigVersionSchema,
  type PublishConfigVersionDto,
  publishConfigVersionSchema,
  type RetireConfigVersionDto,
  retireConfigVersionSchema,
  type SubmitConfigVersionDto,
  submitConfigVersionSchema,
  type UpdateConfigDocumentDto,
  updateConfigDocumentSchema,
  type UpdateConfigDraftDto,
  updateConfigDraftSchema,
  versionNumberSchema,
} from './config.dto.js';

export type VersionedConfigOptions = { resource: ConfigResource; path: string; name: string };

export function createVersionedConfigController({ resource, path, name }: VersionedConfigOptions): Type {
  const allow = (action: AppAction) => CheckPolicies((ability) => ability.can(action, configSubject(resource)));

  @Controller(`admin/${path}`)
  @StaffOnly()
  class VersionedConfigController {
    constructor(@Inject(ConfigPublishingService) private readonly config: ConfigPublishingService) {}

    @Get()
    @allow(AppAction.Read)
    list(@ValidQuery(configDocumentListSchema) query: ConfigDocumentListQuery) {
      return this.config.listDocuments(resource, query);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Idempotent()
    @allow(AppAction.Create)
    create(@ValidBody(createConfigDocumentSchema) body: CreateConfigDocumentDto, @CurrentActor() actor: UserActor) {
      return this.config.createDocument(resource, body, actor);
    }

    @Get(':id')
    @allow(AppAction.Read)
    get(@ValidParam('id', uuidSchema) id: string) {
      return this.config.getDocument(resource, id);
    }

    @Patch(':id')
    @allow(AppAction.Update)
    update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateConfigDocumentSchema) body: UpdateConfigDocumentDto, @IfMatchVersion() version: number | undefined) {
      return this.config.updateDocument(resource, id, body, version);
    }

    @Post(':id/versions')
    @HttpCode(HttpStatus.CREATED)
    @allow(AppAction.Update)
    createVersion(@ValidParam('id', uuidSchema) id: string, @ValidBody(createConfigVersionSchema) body: CreateConfigVersionDto, @CurrentActor() actor: UserActor) {
      return this.config.createVersion(resource, id, body, actor);
    }

    @Get(':id/versions/:number')
    @allow(AppAction.Read)
    getVersion(@ValidParam('id', uuidSchema) id: string, @ValidParam('number', versionNumberSchema) number: number) {
      return this.config.getVersion(resource, id, number);
    }

    @Patch(':id/versions/:number')
    @allow(AppAction.Update)
    updateDraft(
      @ValidParam('id', uuidSchema) id: string,
      @ValidParam('number', versionNumberSchema) number: number,
      @ValidBody(updateConfigDraftSchema) body: UpdateConfigDraftDto,
      @IfMatchVersion() version: number | undefined,
    ) {
      return this.config.updateDraft(resource, id, number, body, version);
    }

    @Post(':id/versions/:number/submit')
    @HttpCode(HttpStatus.OK)
    @allow(AppAction.Update)
    submit(
      @ValidParam('id', uuidSchema) id: string,
      @ValidParam('number', versionNumberSchema) number: number,
      @ValidBody(submitConfigVersionSchema) body: SubmitConfigVersionDto,
      @IfMatchVersion() version: number | undefined,
      @CurrentActor() actor: UserActor,
    ) {
      return this.config.submit(resource, id, number, body.reason, version, actor);
    }

    @Post(':id/versions/:number/publish')
    @HttpCode(HttpStatus.OK)
    @allow(AppAction.Publish)
    publish(
      @ValidParam('id', uuidSchema) id: string,
      @ValidParam('number', versionNumberSchema) number: number,
      @ValidBody(publishConfigVersionSchema) body: PublishConfigVersionDto,
      @CurrentActor() actor: UserActor,
    ) {
      return this.config.publish(resource, id, number, body.effectiveFrom, actor);
    }

    @Post(':id/versions/:number/retire')
    @HttpCode(HttpStatus.OK)
    @allow(AppAction.Publish)
    retire(
      @ValidParam('id', uuidSchema) id: string,
      @ValidParam('number', versionNumberSchema) number: number,
      @ValidBody(retireConfigVersionSchema) body: RetireConfigVersionDto,
      @CurrentActor() actor: UserActor,
    ) {
      return this.config.retire(resource, id, number, body.reason, actor);
    }
  }

  Object.defineProperty(VersionedConfigController, 'name', { value: name });
  return VersionedConfigController;
}
