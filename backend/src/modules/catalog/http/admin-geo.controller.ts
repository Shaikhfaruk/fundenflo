import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction, NonModelSubject } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { GeoService } from '../application/geo.service.js';
import {
  type CreateAliasDto,
  createAliasSchema,
  type CreateCityDto,
  createCitySchema,
  type ListAliasesQuery,
  listAliasesSchema,
  type ListCitiesQuery,
  listCitiesSchema,
  type ListPincodesQuery,
  listPincodesSchema,
  type UpdateCityDto,
  updateCitySchema,
  type UpsertPincodeDto,
  upsertPincodeSchema,
} from './catalog.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, NonModelSubject.Catalog));
const canCreate = CheckPolicies((ability) => ability.can(AppAction.Create, NonModelSubject.Catalog));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, NonModelSubject.Catalog));
const canDelete = CheckPolicies((ability) => ability.can(AppAction.Delete, NonModelSubject.Catalog));

@Controller('admin')
@StaffOnly()
export class AdminGeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('geo/cities')
  @canRead
  listCities(@ValidQuery(listCitiesSchema) query: ListCitiesQuery) {
    return this.geo.listCities({ ...query, stateGstCode: query.state });
  }

  @Post('geo/cities')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createCity(@ValidBody(createCitySchema) body: CreateCityDto) {
    return this.geo.createCity(body);
  }

  @Patch('geo/cities/:id')
  @canUpdate
  updateCity(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateCitySchema) body: UpdateCityDto, @IfMatchVersion() version: number | undefined) {
    return this.geo.updateCity(id, body, version);
  }

  @Get('geo/pincodes')
  @canRead
  listPincodes(@ValidQuery(listPincodesSchema) query: ListPincodesQuery) {
    return this.geo.listPincodes({ ...query, stateGstCode: query.state });
  }

  @Post('geo/pincodes')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  upsertPincode(@ValidBody(upsertPincodeSchema) body: UpsertPincodeDto) {
    return this.geo.upsertPincode(body);
  }

  @Get('lookup-aliases')
  @canRead
  listAliases(@ValidQuery(listAliasesSchema) query: ListAliasesQuery) {
    return this.geo.listAliases(query);
  }

  @Post('lookup-aliases')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @canCreate
  createAlias(@ValidBody(createAliasSchema) body: CreateAliasDto, @CurrentActor() actor: UserActor) {
    return this.geo.createAlias(body, actor.userId);
  }

  @Delete('lookup-aliases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @canDelete
  async deleteAlias(@ValidParam('id', uuidSchema) id: string) {
    await this.geo.deleteAlias(id);
  }
}
