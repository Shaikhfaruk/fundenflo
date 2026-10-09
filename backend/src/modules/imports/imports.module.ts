import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ImportHandlerRegistry } from './application/import-handler.registry.js';
import { ImportService } from './application/import.service.js';
import { AdminImportsController } from './http/admin-imports.controller.js';
import { ImportProcessor } from './infrastructure/import.processor.js';
import { ImportRepository } from './infrastructure/import.repository.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [AdminImportsController],
  providers: [ImportRepository, ImportHandlerRegistry, ImportService],
  exports: [ImportService],
})
export class ImportsModule {}

export const IMPORT_PROCESSORS = [ImportProcessor];
