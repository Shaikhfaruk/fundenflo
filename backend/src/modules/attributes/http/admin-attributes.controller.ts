import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { AttributeDictionary } from '../application/attribute-dictionary.service.js';
import { FactService } from '../application/fact.service.js';
import {
  type CreateAttributeDto,
  createAttributeSchema,
  type EvaluateConditionDto,
  evaluateConditionSchema,
  type ListAttributesQuery,
  listAttributesSchema,
  type UpdateAttributeDto,
  updateAttributeSchema,
  type ValidateConditionDto,
  validateConditionSchema,
} from './attributes.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'AttributeDefinition'));

@Controller('admin')
@StaffOnly()
export class AdminAttributesController {
  constructor(
    private readonly dictionary: AttributeDictionary,
    private readonly facts: FactService,
  ) {}

  @Get('attributes')
  @canRead
  async list(@ValidQuery(listAttributesSchema) query: ListAttributesQuery) {
    return { items: await this.dictionary.list(query) };
  }

  @Post('attributes')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'AttributeDefinition'))
  create(@ValidBody(createAttributeSchema) body: CreateAttributeDto) {
    return this.dictionary.create(body);
  }

  @Get('attributes/:id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.dictionary.get(id);
  }

  @Patch('attributes/:id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'AttributeDefinition'))
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(updateAttributeSchema) body: UpdateAttributeDto, @IfMatchVersion() version: number | undefined) {
    return this.dictionary.update(id, body, version);
  }

  @Post('conditions/validate')
  @HttpCode(HttpStatus.OK)
  @canRead
  validate(@ValidBody(validateConditionSchema) body: ValidateConditionDto) {
    return this.dictionary.validate(body.condition);
  }

  @Post('conditions/evaluate')
  @HttpCode(HttpStatus.OK)
  @canRead
  async evaluate(@ValidBody(evaluateConditionSchema) body: EvaluateConditionDto) {
    const lookup = await this.facts.lookup(body.partyId ?? null, (body.facts ?? {}) as Record<string, FactValue>);
    const trace = await this.dictionary.evaluate(body.condition, lookup);
    return { outcome: trace.outcome, trace };
  }
}
