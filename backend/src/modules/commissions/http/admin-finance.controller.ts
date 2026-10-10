import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { LedgerService } from '../application/ledger.service.js';
import { PayoutService } from '../application/payout.service.js';
import { ReceivableService } from '../application/receivable.service.js';
import { ReconciliationService } from '../application/reconciliation.service.js';
import {
  type ApprovePayoutDto,
  approvePayoutSchema,
  type ListPayoutsDto,
  listPayoutsSchema,
  type ListReceivablesDto,
  listReceivablesSchema,
  type MarkPaidDto,
  markPaidSchema,
  type ReceivableActionDto,
  receivableActionSchema,
  type ReconciliationDto,
  reconciliationSchema,
  type ReversePayoutDto,
  reversePayoutSchema,
} from './commissions.dto.js';

const canUpdatePayout = CheckPolicies((ability) => ability.can(AppAction.Update, 'PartnerPayout'));

@Controller('admin/finance')
@StaffOnly()
export class AdminFinanceController {
  constructor(
    private readonly receivables: ReceivableService,
    private readonly payouts: PayoutService,
    private readonly reconciliation: ReconciliationService,
    private readonly ledger: LedgerService,
  ) {}

  @Get('receivables')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Receivable'))
  listReceivables(@ValidQuery(listReceivablesSchema) query: ListReceivablesDto, @CurrentAbility() ability: AppAbility) {
    return this.receivables.list(ability, query);
  }

  @Get('receivables/:id')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Receivable'))
  getReceivable(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.receivables.get(id, ability);
  }

  @Patch('receivables/:id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Receivable'))
  updateReceivable(@ValidParam('id', uuidSchema) id: string, @ValidBody(receivableActionSchema) body: ReceivableActionDto, @CurrentAbility() ability: AppAbility) {
    return this.receivables.act(id, body, ability);
  }

  @Get('payouts')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'PartnerPayout'))
  listPayouts(@ValidQuery(listPayoutsSchema) query: ListPayoutsDto, @CurrentAbility() ability: AppAbility) {
    return this.payouts.list(ability, query);
  }

  @Get('payouts/:id')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'PartnerPayout'))
  getPayout(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.payouts.detail(id, ability);
  }

  @Post('payouts/:id/approve')
  @HttpCode(HttpStatus.OK)
  @canUpdatePayout
  approve(@ValidParam('id', uuidSchema) id: string, @ValidBody(approvePayoutSchema) body: ApprovePayoutDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.payouts.approve(id, body.expectedVersion, actor, ability);
  }

  @Post('payouts/:id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @canUpdatePayout
  markPaid(@ValidParam('id', uuidSchema) id: string, @ValidBody(markPaidSchema) body: MarkPaidDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.payouts.markPaid(id, body, actor, ability);
  }

  @Post('payouts/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @canUpdatePayout
  reverse(@ValidParam('id', uuidSchema) id: string, @ValidBody(reversePayoutSchema) body: ReversePayoutDto, @CurrentAbility() ability: AppAbility) {
    return this.payouts.reverse(id, body, ability);
  }

  @Get('reconciliation')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'ReconciliationRun'))
  runs(@ValidQuery(pageQuerySchema) query: PageQuery, @CurrentAbility() ability: AppAbility) {
    return this.reconciliation.list(ability, query);
  }

  @Post('reconciliation')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'ReconciliationRun'))
  reconcile(@ValidBody(reconciliationSchema) body: ReconciliationDto, @CurrentActor() actor: UserActor) {
    return this.reconciliation.run(body, actor);
  }

  @Get('ledger/trial-balance')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LedgerEntry'))
  trialBalance() {
    return this.ledger.trialBalance();
  }
}
