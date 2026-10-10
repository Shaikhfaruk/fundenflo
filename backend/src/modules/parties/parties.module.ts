import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ContactCodec } from './application/contact-codec.service.js';
import { PartyCoreMergeParticipant } from './application/party-core-merge.participant.js';
import { PartyMergeRegistry } from './application/party-merge.registry.js';
import { PartyMergeService } from './application/party-merge.service.js';
import { PartyResolver } from './application/party-resolver.service.js';
import { PartyService } from './application/party.service.js';
import { OpsPartyMergesController } from './http/ops-party-merges.controller.js';
import { PartyRepository } from './infrastructure/party.repository.js';
import { PartyPrivacyParticipant } from './application/party-privacy.participant.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [OpsPartyMergesController],
  providers: [PartyPrivacyParticipant, PartyRepository, ContactCodec, PartyService, PartyResolver, PartyMergeRegistry, PartyMergeService, PartyCoreMergeParticipant],
  exports: [ContactCodec, PartyService, PartyResolver],
})
export class PartiesModule {}
