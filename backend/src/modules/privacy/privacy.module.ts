import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module.js';
import { DataRequestService } from './application/data-request.service.js';
import { PrivacyParticipantRegistry } from './application/privacy-participant.registry.js';
import { MeDataRequestsController } from './http/me-data-requests.controller.js';
import { OpsDataRequestsController } from './http/ops-data-requests.controller.js';
import { DataRequestProcessor } from './infrastructure/data-request.processor.js';
import { DataRequestRepository } from './infrastructure/data-request.repository.js';
import { PrivacyMaintenance } from './infrastructure/privacy.maintenance.js';

export const PRIVACY_PROCESSORS = [DataRequestProcessor];

@Module({
  imports: [AuthModule, DiscoveryModule],
  controllers: [MeDataRequestsController, OpsDataRequestsController],
  providers: [DataRequestRepository, PrivacyParticipantRegistry, DataRequestService, PrivacyMaintenance],
  exports: [DataRequestService],
})
export class PrivacyModule {}
