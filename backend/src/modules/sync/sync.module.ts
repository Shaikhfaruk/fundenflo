import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SyncSourceRegistry } from './application/sync-source.registry.js';
import { SyncService } from './application/sync.service.js';
import { SyncController } from './http/sync.controller.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [SyncController],
  providers: [SyncSourceRegistry, SyncService],
})
export class SyncModule {}
