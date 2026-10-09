import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SlaHandlerRegistry } from './application/sla-handler.registry.js';
import { SlaService } from './application/sla.service.js';
import { SlaSweepProcessor } from './infrastructure/sla-sweep.processor.js';
import { SlaRepository } from './infrastructure/sla.repository.js';

@Module({
  imports: [DiscoveryModule],
  providers: [SlaRepository, SlaHandlerRegistry, SlaService],
  exports: [SlaService],
})
export class SlaModule {}

export const SLA_PROCESSORS = [SlaSweepProcessor];
