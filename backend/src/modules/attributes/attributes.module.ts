import { Module } from '@nestjs/common';

import { PartiesModule } from '../parties/parties.module.js';
import { AttributeDictionary } from './application/attribute-dictionary.service.js';
import { FactService } from './application/fact.service.js';
import { AdminAttributesController } from './http/admin-attributes.controller.js';
import { OpsFactsController } from './http/ops-facts.controller.js';
import { AttributeRepository } from './infrastructure/attribute.repository.js';
import { FactRepository } from './infrastructure/fact.repository.js';

@Module({
  imports: [PartiesModule],
  controllers: [AdminAttributesController, OpsFactsController],
  providers: [AttributeRepository, FactRepository, AttributeDictionary, FactService],
  exports: [AttributeDictionary, FactService],
})
export class AttributesModule {}
