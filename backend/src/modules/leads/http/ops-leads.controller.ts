import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { AnswerChannel, ConsentChannel } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { LeadEvent } from '../../../engines/state-machines/machines/lead.machine.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { LeadCaptureService } from '../application/lead-capture.service.js';
import { LeadSourceService } from '../application/lead-source.service.js';
import { LeadService } from '../application/lead.service.js';
import { LeadSourceKey } from '../domain/lead.constants.js';
import {
  type LeadDisqualifyDto,
  leadDisqualifySchema,
  type LeadHoldDto,
  leadHoldSchema,
  type LeadListQuery,
  leadListSchema,
  type LeadLoseDto,
  leadLoseSchema,
  type LeadMergeDto,
  leadMergeSchema,
  type LeadNoteDto,
  leadNoteSchema,
  type LeadPatchDto,
  leadPatchSchema,
  type OpsLeadDto,
  opsLeadSchema,
  type RevealContactDto,
  revealContactSchema,
} from './leads.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'Lead'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'Lead'));

@Controller('ops/leads')
@StaffOnly()
export class OpsLeadsController {
  constructor(
    private readonly capture: LeadCaptureService,
    private readonly sources: LeadSourceService,
    private readonly leads: LeadService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Lead'))
  async create(@ValidBody(opsLeadSchema) body: OpsLeadDto, @CurrentActor() actor: UserActor, @RequestLocale() locale: Locale) {
    const { source, ...input } = body;
    const result = await this.capture.capture(input, {
      source: await this.sources.activeByKey(source ?? LeadSourceKey.Manual),
      consentChannel: ConsentChannel.ops_call,
      answerChannel: AnswerChannel.ops,
      capturedByUserId: actor.userId,
      locale,
    });
    return result.lead;
  }

  @Get()
  @canRead
  list(@ValidQuery(leadListSchema) query: LeadListQuery) {
    return this.leads.list(query);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  merge(@ValidBody(leadMergeSchema) body: LeadMergeDto) {
    return this.leads.merge(body.survivorLeadId, body.leadIds, body.note);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string) {
    return this.leads.get(id);
  }

  @Patch(':id')
  @canUpdate
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadPatchSchema) body: LeadPatchDto, @IfMatchVersion() version: number | undefined) {
    return this.leads.update(id, body, version);
  }

  @Post(':id/qualify')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  qualify(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadNoteSchema) body: LeadNoteDto) {
    return this.leads.act(id, { event: LeadEvent.Qualify, note: body.note });
  }

  @Post(':id/disqualify')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  disqualify(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadDisqualifySchema) body: LeadDisqualifyDto) {
    return this.leads.act(id, { event: LeadEvent.Disqualify, reason: body.reason, note: body.note });
  }

  @Post(':id/hold')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  hold(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadHoldSchema) body: LeadHoldDto) {
    return this.leads.act(id, { event: LeadEvent.Hold, note: body.note, holdUntil: body.holdUntil });
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  reopen(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadNoteSchema) body: LeadNoteDto) {
    return this.leads.act(id, { event: LeadEvent.Reopen, note: body.note });
  }

  @Post(':id/recycle')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  recycle(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadNoteSchema) body: LeadNoteDto) {
    return this.leads.act(id, { event: LeadEvent.Recycle, note: body.note });
  }

  @Post(':id/lose')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  lose(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadLoseSchema) body: LeadLoseDto) {
    return this.leads.act(id, { event: LeadEvent.Lose, reason: body.reason, note: body.note });
  }

  @Post(':id/reveal-contact')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  reveal(@ValidParam('id', uuidSchema) id: string, @ValidBody(revealContactSchema) body: RevealContactDto) {
    return this.leads.revealContacts(id, body.reason);
  }
}
