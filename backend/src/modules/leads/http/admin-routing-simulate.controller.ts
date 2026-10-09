import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { ConfigResource } from '../../../common/enums/db.enums.js';
import { ValidBody } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { configSubject } from '../../config-publishing/application/config-subject.js';
import { LeadRoutingService } from '../application/lead-routing.service.js';
import { type SimulateRoutingDto, simulateRoutingSchema } from './leads.dto.js';

@Controller('admin/routing-rules/simulate')
@StaffOnly()
export class AdminRoutingSimulateController {
  constructor(private readonly routing: LeadRoutingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Read, configSubject(ConfigResource.routing_rule)))
  simulate(@ValidBody(simulateRoutingSchema) body: SimulateRoutingDto) {
    return this.routing.route(body.leadId, { record: false, dryRun: true });
  }
}
