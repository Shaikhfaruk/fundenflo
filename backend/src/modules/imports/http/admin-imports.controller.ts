import { Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { type ImportKind, ImportRowStatus } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { ImportService } from '../application/import.service.js';
import { ImportJob } from '../domain/import.constants.js';
import {
  type CreateImportDto,
  createImportSchema,
  importKindSchema,
  type ImportMappingDto,
  importMappingSchema,
  type ImportRowsQuery,
  importRowsSchema,
  type ListImportsQuery,
  listImportsSchema,
} from './imports.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'ImportBatch'));
const canRun = CheckPolicies((ability) => ability.can(AppAction.Update, 'ImportBatch'));

@Controller('admin/imports')
@StaffOnly()
export class AdminImportsController {
  constructor(private readonly imports: ImportService) {}

  @Get('fields/:kind')
  @canRead
  fields(@ValidParam('kind', importKindSchema) kind: ImportKind) {
    return this.imports.fields(kind);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'ImportBatch'))
  create(@ValidBody(createImportSchema) body: CreateImportDto, @CurrentActor() actor: UserActor) {
    return this.imports.create(body, actor);
  }

  @Get()
  @canRead
  list(@ValidQuery(listImportsSchema) query: ListImportsQuery) {
    return this.imports.list(query);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.imports.get(id);
  }

  @Post(':id/inspect')
  @HttpCode(HttpStatus.OK)
  @canRun
  inspect(@ValidParam('id', uuidSchema) id: string) {
    return this.imports.inspect(id);
  }

  @Put(':id/mapping')
  @canRun
  mapping(@ValidParam('id', uuidSchema) id: string, @ValidBody(importMappingSchema) body: ImportMappingDto, @IfMatchVersion() version: number | undefined) {
    return this.imports.setMapping(id, body, version);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.ACCEPTED)
  @canRun
  validate(@ValidParam('id', uuidSchema) id: string) {
    return this.imports.start(id, ImportJob.Validate);
  }

  @Post(':id/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @canRun
  commit(@ValidParam('id', uuidSchema) id: string) {
    return this.imports.start(id, ImportJob.Commit);
  }

  @Post(':id/undo')
  @HttpCode(HttpStatus.ACCEPTED)
  @canRun
  undo(@ValidParam('id', uuidSchema) id: string) {
    return this.imports.start(id, ImportJob.Undo);
  }

  @Get(':id/errors')
  @canRead
  errors(@ValidParam('id', uuidSchema) id: string, @ValidQuery(importRowsSchema) query: ImportRowsQuery) {
    return this.imports.rows(id, query.status ?? [ImportRowStatus.invalid, ImportRowStatus.failed], query);
  }
}
