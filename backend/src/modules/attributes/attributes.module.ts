import { Module } from '@nestjs/common';

import { PartiesModule } from '../parties/parties.module.js';
import { AttributeDictionary } from './application/attribute-dictionary.service.js';
import { ConsistencyService } from './application/consistency.service.js';
import { FactMergeParticipant } from './application/fact-merge.participant.js';
import { FactService } from './application/fact.service.js';
import { AdminAttributesController } from './http/admin-attributes.controller.js';
import { OpsConsistencySignalsController } from './http/ops-consistency-signals.controller.js';
import { OpsFactsController } from './http/ops-facts.controller.js';
import { AttributeRepository } from './infrastructure/attribute.repository.js';
import { ConsistencyRepository } from './infrastructure/consistency.repository.js';
import { FactRepository } from './infrastructure/fact.repository.js';
import { FactPrivacyParticipant } from './application/fact-privacy.participant.js';

@Module({
  imports: [PartiesModule],
  controllers: [AdminAttributesController, OpsFactsController, OpsConsistencySignalsController],
  providers: [FactPrivacyParticipant, FactMergeParticipant, AttributeRepository, FactRepository, ConsistencyRepository, ConsistencyService, AttributeDictionary, FactService],
  exports: [AttributeDictionary, FactService, ConsistencyService],
})
export class AttributesModule {}
