import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction, NonModelSubject } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import {
  type CreateCategoryDto,
  createCategorySchema,
  type CreatePurposeDto,
  createPurposeSchema,
  type CreateSegmentDto,
  createSegmentSchema,
  type CreateSubSegmentDto,
  createSubSegmentSchema,
  type UpdateCategoryDto,
  updateCategorySchema,
  type UpdatePurposeDto,
  updatePurposeSchema,
  type UpdateSegmentDto,
  updateSegmentSchema,
  type UpdateSubSegmentDto,
  updateSubSegmentSchema,
} from './catalog.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, NonModelSubject.Catalog));
const canCreate = CheckPolicies((ability) => ability.can(AppAction.Create, NonModelSubject.Catalog));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, NonModelSubject.Catalog));

@Controller('admin')
@StaffOnly()
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get('segments')
  @canRead
  async listSegments() {
    return { items: await this.catalog.listSegments() };
  }

  @Post('segments')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createSegment(@ValidBody(createSegmentSchema) body: CreateSegmentDto) {
    return this.catalog.createSegment(body);
  }

  @Patch('segments/:id')
  @canUpdate
  updateSegment(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateSegmentSchema) body: UpdateSegmentDto, @IfMatchVersion() version: number | undefined) {
    return this.catalog.updateSegment(id, body, version);
  }

  @Post('segments/:id/sub-segments')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createSubSegment(@ValidParam('id', uuidSchema) id: string, @ValidBody(createSubSegmentSchema) body: CreateSubSegmentDto) {
    return this.catalog.createSubSegment(id, body);
  }

  @Patch('sub-segments/:id')
  @canUpdate
  updateSubSegment(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateSubSegmentSchema) body: UpdateSubSegmentDto, @IfMatchVersion() version: number | undefined) {
    return this.catalog.updateSubSegment(id, body, version);
  }

  @Get('loan-categories')
  @canRead
  async listCategories() {
    return { items: await this.catalog.listCategories() };
  }

  @Post('loan-categories')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createCategory(@ValidBody(createCategorySchema) body: CreateCategoryDto) {
    return this.catalog.createCategory(body);
  }

  @Get('loan-categories/:id')
  @canRead
  getCategory(@ValidParam('id', uuidSchema) id: string) {
    return this.catalog.getCategory(id);
  }

  @Patch('loan-categories/:id')
  @canUpdate
  updateCategory(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateCategorySchema) body: UpdateCategoryDto, @IfMatchVersion() version: number | undefined) {
    return this.catalog.updateCategory(id, body, version);
  }

  @Post('loan-categories/:id/purposes')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createPurpose(@ValidParam('id', uuidSchema) id: string, @ValidBody(createPurposeSchema) body: CreatePurposeDto) {
    return this.catalog.createPurpose(id, body);
  }

  @Patch('loan-categories/:id/purposes/:purposeId')
  @canUpdate
  updatePurpose(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('purposeId', uuidSchema) purposeId: string,
    @ValidBody(updatePurposeSchema) body: UpdatePurposeDto,
    @IfMatchVersion() version: number | undefined,
  ) {
    return this.catalog.updatePurpose(id, purposeId, body, version);
  }
}
