import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AccessModule } from '../access/access.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { LendersModule } from '../lenders/lenders.module.js';
import { PartnersModule } from '../partners/partners.module.js';
import { CommissionNotificationService } from './application/commission-notification.service.js';
import { CommissionSchemeHandler } from './application/commission-scheme.handler.js';
import { CommissionService } from './application/commission.service.js';
import { LedgerService } from './application/ledger.service.js';
import { PartnerCommissionService } from './application/partner-commission.service.js';
import { PayoutService } from './application/payout.service.js';
import { ReceivableService } from './application/receivable.service.js';
import { ReconciliationService } from './application/reconciliation.service.js';
import { AdminFinanceController } from './http/admin-finance.controller.js';
import { PartnerCommissionsController } from './http/partner-commissions.controller.js';
import { CommissionAccrueProcessor } from './infrastructure/commission-accrue.processor.js';
import { CommissionNotifyProcessor } from './infrastructure/commission-notify.processor.js';
import { CommissionRepository } from './infrastructure/commission.repository.js';
import { LedgerRepository } from './infrastructure/ledger.repository.js';

const AdminCommissionSchemesController = createVersionedConfigController({ resource: ConfigResource.commission_scheme, path: 'commission-schemes', name: 'AdminCommissionSchemesController' });

export const COMMISSION_PROCESSORS = [CommissionAccrueProcessor, CommissionNotifyProcessor];

@Module({
  imports: [AccessModule, ApplicationsModule, AuthModule, CatalogModule, ConfigPublishingModule, LendersModule, PartnersModule],
  controllers: [AdminCommissionSchemesController, AdminFinanceController, PartnerCommissionsController],
  providers: [CommissionRepository, LedgerRepository, LedgerService, CommissionSchemeHandler, CommissionService, PayoutService, ReceivableService, ReconciliationService, PartnerCommissionService, CommissionNotificationService],
  exports: [CommissionService, CommissionNotificationService, LedgerService],
})
export class CommissionsModule {}
