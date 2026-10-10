import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { ConfigResource } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { configSubject } from '../../config-publishing/application/config-subject.js';
import { versionNumberSchema } from '../../config-publishing/http/config.dto.js';
import { LenderSimulationService } from '../application/lender-simulation.service.js';
import { type SimulateDto, simulateSchema } from './lenders.dto.js';

@Controller('admin/lender-products')
@StaffOnly()
export class AdminLenderProductSimulateController {
  constructor(private readonly simulation: LenderSimulationService) {}

  @Post(':id/versions/:number/simulate')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Read, configSubject(ConfigResource.lender_product)))
  simulate(@ValidParam('id', uuidSchema) id: string, @ValidParam('number', versionNumberSchema) number: number, @ValidBody(simulateSchema) body: SimulateDto) {
    return this.simulation.simulate(id, number, body.profiles);
  }
}
