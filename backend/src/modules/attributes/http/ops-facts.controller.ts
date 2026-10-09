import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { FactProvenance } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { FactService } from '../application/fact.service.js';
import { FactSourceType } from '../domain/attribute.constants.js';
import { type FactHistoryQuery, factHistorySchema, type RecordFactsDto, recordFactsSchema } from './attributes.dto.js';

@Controller('ops/parties/:partyId/facts')
@StaffOnly()
export class OpsFactsController {
  constructor(private readonly facts: FactService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'))
  async current(@ValidParam('partyId', uuidSchema) partyId: string) {
    return { items: await this.facts.snapshot(partyId) };
  }

  @Get('history')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Party'))
  history(@ValidParam('partyId', uuidSchema) partyId: string, @ValidQuery(factHistorySchema) query: FactHistoryQuery) {
    return this.facts.history(partyId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Party'))
  async record(@ValidParam('partyId', uuidSchema) partyId: string, @ValidBody(recordFactsSchema) body: RecordFactsDto, @CurrentActor() actor: UserActor) {
    const items = await this.facts.record(partyId, body.facts, {
      provenance: FactProvenance.ops_verified,
      sourceType: FactSourceType.OpsEntry,
      sourceId: body.note,
      recordedByUserId: actor.userId,
    });
    return { items };
  }
}
