import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { DocumentRejectReason } from '../../../common/enums/db.enums.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { ExtractionService } from '../application/extraction.service.js';

const reviewSchema = z
  .object({
    outcome: z.enum(['verified', 'rejected']),
    fields: z.array(z.object({ attributeKey: z.string().min(3).max(100), value: z.unknown() }).strict()).max(50).default([]),
    rejectReason: z.enum(Object.values(DocumentRejectReason)).optional(),
    note: z.string().trim().min(3).max(1_000).optional(),
  })
  .strict();

@Controller('ops/documents')
@StaffOnly()
export class OpsDocumentsController {
  constructor(private readonly extraction: ExtractionService) {}

  @Get(':id/extractions')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Document'))
  extractions(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.extraction.extractions(id, ability);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Document'))
  review(@ValidParam('id', uuidSchema) id: string, @ValidBody(reviewSchema) body: z.output<typeof reviewSchema>, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.extraction.review(id, body, actor, ability);
  }
}
