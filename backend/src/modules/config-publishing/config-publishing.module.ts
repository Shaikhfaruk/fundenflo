import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ConfigHandlerRegistry } from './application/config-handler.registry.js';
import { ConfigPublishingService } from './application/config-publishing.service.js';
import { AdminChangeRequestsController } from './http/admin-change-requests.controller.js';
import { ConfigRepository } from './infrastructure/config.repository.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [AdminChangeRequestsController],
  providers: [ConfigRepository, ConfigHandlerRegistry, ConfigPublishingService],
  exports: [ConfigPublishingService],
})
export class ConfigPublishingModule {}
